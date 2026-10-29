import { EntityManager } from 'typeorm';
import type { Product } from '../catalog/entities';
import { toDateKey } from '../common/dates';
import type { Fulfillment, OrderSource, OrderStatus, PaymentType } from '../common/types';
import { Customer } from '../customers/customer.entity';
import { nextCounter } from '../database/counters';
import { Expense } from '../expenses/expense.entities';
import { Order, OrderLine, OrderSlot } from '../orders/order.entity';
import { OrdersService } from '../orders/orders.service';
import { Review } from '../reviews/review.entity';
import { parseStockKey, stockKey, type StockKey } from '../stock/stock-key';
import { StockService } from '../stock/stock.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { SEED } from './base-data';

/**
 * Demo tarix (frontend `data/history.ts` dan): 60 kun oldin boshlang'ich prixod, 30 kunlik sotuv (kassa + bot),
 * qo'shimcha prixodlar, to'lovlar va qarz, chiqimlar, bitta spisanie va inventarizatsiya, sharhlar, bugungi faol bot
 * buyurtmalari. Tasodifiy, lekin har safar bir xil (seed qilingan PRNG). Ombor, tannarx va hujjatlar — haqiqiy
 * servislar orqali (frontend demo bilan bir xil qoidalar).
 */

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const SLOT_FIRST_HOUR = 10;
const SLOT_LAST_HOUR = 21;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ism va jinsi — familiya shunga mos: Karimov / Karimova */
const FIRST_NAMES: [name: string, gender: 'f' | 'm'][] = [
  ['Madina', 'f'],
  ['Sardor', 'm'],
  ['Nilufar', 'f'],
  ['Bekzod', 'm'],
  ['Shahzoda', 'f'],
  ['Otabek', 'm'],
  ['Malika', 'f'],
  ['Javohir', 'm'],
  ['Kamola', 'f'],
  ['Sherzod', 'm'],
  ['Dilfuza', 'f'],
  ['Rustam', 'm'],
  ['Gulnora', 'f'],
  ['Timur', 'm'],
  ['Sevara', 'f'],
  ['Anvar', 'm'],
  ['Zarina', 'f'],
  ['Farrux', 'm'],
  ['Lola', 'f'],
  ['Elyor', 'm'],
  ['Анна', 'f'],
  ['Дмитрий', 'm'],
  ['Екатерина', 'f'],
  ['Алишер', 'm'],
  ['Виктория', 'f'],
];
const LAST_NAMES = [
  'Karimov',
  'Aliyev',
  'Saidov',
  'Yusupov',
  'Rashidov',
  'Nazarov',
  'Ismoilov',
  'Qodirov',
  'Soliyev',
  'Ergashev',
];
const ADDRESSES = [
  'Chilonzor 9-kvartal, 12-uy, 45-xonadon',
  'Yunusobod 4-mavze, 8-uy',
  "Mirzo Ulug'bek, Buyuk Ipak Yo'li 120",
  "Shayxontohur, Navoiy ko'chasi 30",
  'Sergeli, Yangi Sergeli 5-uy',
  'Olmazor, Qorasaroy 17',
];
const REVIEW_TEXTS = [
  'Очень стойкий аромат, держится весь день. Спасибо!',
  'Atir juda yoqdi, original bilan bir xil. Rahmat!',
  'Быстро подготовили заказ, флакон красивый.',
  "Hidi ajoyib, do'stlarimga ham tavsiya qildim.",
  'Аромат как в описании, буду заказывать ещё.',
  "Yetkazib berish tez bo'ldi, atir zo'r.",
  'Шлейф заметный, получила много комплиментов.',
  "Narxi ham, sifati ham ma'qul.",
];
const PAYMENTS: PaymentType[] = ['cash', 'cash', 'card', 'card', 'click', 'payme'];
const FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'done'];

export interface HistoryServices {
  stock: StockService;
  orders: OrdersService;
  warehouse: WarehouseService;
}

export async function generateHistory(em: EntityManager, services: HistoryServices): Promise<void> {
  const { stock, orders, warehouse } = services;
  const random = mulberry32(20261028);
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const round = (value: number, step: number) => Math.round(value / step) * step;

  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = (daysAgo: number) => today.getTime() - daysAgo * DAY;
  // himoya: hech bir yozuv kelajak vaqt bilan chiqmasin
  const time = (ms: number) => new Date(Math.min(ms, now));
  const admin = SEED.users.find((user) => user.role === 'admin')?.id ?? 'u-admin';
  const cashiers = SEED.users.filter((user) => user.role === 'cashier').map((user) => user.id);
  const allProducts = SEED.products as Omit<Product, 'createdAt'>[];
  const products = allProducts.filter((product) => product.active);
  if (products.length === 0 || cashiers.length === 0) return;

  // ───── mijozlar ─────
  const customers: Customer[] = [];
  for (let i = 0; i < 26; i++) {
    const [first, gender] = FIRST_NAMES[i % FIRST_NAMES.length];
    const name = /[А-Яа-я]/.test(first) ? first : `${first} ${pick(LAST_NAMES)}${gender === 'f' ? 'a' : ''}`;
    customers.push({
      id: `c-${i + 1}`,
      name,
      phone: `9989${pick(['0', '1', '3', '7', '9'])}${String(between(1_000_000, 9_999_999))}`,
      telegramId: 500_000_000 + i * 7919,
      createdAt: time(dayStart(between(31, 58))),
    });
  }
  await em.insert(Customer, customers);

  // ───── prixod ─────
  const costOf = (key: StockKey): number => {
    const { kind, id } = parseStockKey(key)!;
    if (kind === 'flakon')
      return round((SEED.flakons.find((flakon) => flakon.id === id)?.price ?? 10_000) * 0.3, 100);
    const product = allProducts.find((item) => item.id === id)!;
    return kind === 'gram'
      ? round(product.pricePerGram * (0.36 + random() * 0.08), 10)
      : round((product.bottle?.price ?? 0) * 0.72, 1000);
  };
  const supplierFor = (key: StockKey): string => {
    const kind = parseStockKey(key)!.kind;
    return kind === 'gram' ? 'sup-aroma' : kind === 'bottle' ? 'sup-parfum' : 'sup-tara';
  };

  /** Bitta yetkazib beruvchidan prixod; [paidShare] — shu zahoti to'langan ulush (qolgani qarz). */
  const purchase = async (
    at: number,
    keys: StockKey[],
    qtyOf: (key: StockKey) => number,
    paidShare: number,
  ) => {
    const bySupplier = new Map<string, StockKey[]>();
    for (const key of keys)
      bySupplier.set(supplierFor(key), [...(bySupplier.get(supplierFor(key)) ?? []), key]);
    for (const [supplierId, supplierKeys] of bySupplier) {
      const lines = supplierKeys.map((key) => ({ key, qty: qtyOf(key), unitCost: costOf(key) }));
      const total = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
      // yaxlitlash summadan oshib ketmasin (to'liq to'langan prixod "avans" bo'lib qolmasin)
      const paid = Math.min(total, round(total * paidShare, 1000));
      const date = time(at);
      await warehouse.insertPurchase(em, { supplierId, date: toDateKey(date), lines, paid }, admin, date);
    }
  };

  // ombordagi pozitsiyalar — JSON tartibida (tasodifiylik tartibga bog'liq)
  const keys: StockKey[] = [];
  for (const product of allProducts) {
    keys.push(stockKey('gram', product.id));
    if (product.bottle) keys.push(stockKey('bottle', product.id));
  }
  for (const flakon of SEED.flakons) keys.push(stockKey('flakon', flakon.id));

  const initialQty = (key: StockKey) => {
    const kind = parseStockKey(key)!.kind;
    return kind === 'gram' ? between(15, 30) * 100 : kind === 'bottle' ? between(3, 8) : between(120, 300);
  };
  await purchase(dayStart(60) + 11 * HOUR, keys, initialQty, 1);

  // ───── sotuvlar (30 kun) va qo'shimcha prixodlar ─────
  const popularity = new Map(products.map((product) => [product.id, 0.4 + random() * 1.6]));
  const totalWeight = [...popularity.values()].reduce((sum, weight) => sum + weight, 0);
  const pickProduct = () => {
    let value = random() * totalWeight;
    for (const product of products) {
      value -= popularity.get(product.id) ?? 1;
      if (value <= 0) return product;
    }
    return products[products.length - 1];
  };
  const pickGrams = () => {
    const value = random();
    return value < 0.5 ? 50 : value < 0.8 ? 100 : value < 0.95 ? 200 : 500;
  };
  const flakonFor = (grams: number): string =>
    grams <= 50
      ? random() < 0.25
        ? 'fl-spray-50'
        : 'fl-50'
      : grams <= 100
        ? 'fl-100'
        : grams <= 200
          ? 'fl-200'
          : 'fl-500';

  const makeLines = (withFlakon: boolean): OrderLine[] => {
    const count = random() < 0.65 ? 1 : random() < 0.8 ? 2 : 3;
    const lines: OrderLine[] = [];
    for (let i = 0; i < count; i++) {
      const product = pickProduct();
      if (lines.some((line) => line.productId === product.id)) continue;
      const bottle = product.bottle && random() < 0.12;
      if (bottle && product.bottle) {
        lines.push({
          id: `l-${lines.length + 1}`,
          productId: product.id,
          kind: 'bottle',
          name: product.name,
          volumeMl: product.bottle.volumeMl,
          qty: 1,
          unitPrice: product.bottle.price,
        });
      } else {
        const grams = pickGrams();
        const flakonId = flakonFor(grams);
        const flakon = SEED.flakons.find((item) => item.id === flakonId);
        lines.push({
          id: `l-${lines.length + 1}`,
          productId: product.id,
          kind: 'gram',
          name: product.name,
          qty: grams,
          unitPrice: product.pricePerGram,
          ...(withFlakon && flakon && { flakon: { flakonId, paid: random() < 0.45, price: flakon.price } }),
        });
      }
    }
    return lines;
  };

  /** Mijoz tanlagan kun va soat (10:00 – 21:00): [from] dan 1–4 soat keyin; bugun kech bo'lsa (yoki ba'zan) — ertaga. */
  const slotFor = (from: number): OrderSlot => {
    const day = new Date(from);
    const hour = Math.max(SLOT_FIRST_HOUR, day.getHours() + between(1, 4));
    if (hour <= SLOT_LAST_HOUR && random() < 0.7) return { date: toDateKey(day), hour };
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
    return { date: toDateKey(next), hour: between(SLOT_FIRST_HOUR, 18) };
  };
  const slotStart = (slot: OrderSlot) => {
    const [y, m, d] = slot.date.split('-').map(Number);
    return new Date(y, m - 1, d, slot.hour).getTime();
  };

  const created: Order[] = [];

  /**
   * Buyurtma va uning holatlar tarixi. Bot: new dan boshlab har qadam 4–25 daqiqada, "Berildi" — mijoz tanlagan vaqtda
   * (o'sha vaqt hali kelmagan bo'lsa "Tayyor" bo'lib kutib turadi). Kassa sotuvi — darhol done.
   */
  const addOrder = async (
    at: number,
    source: OrderSource,
    wanted: OrderStatus,
    withFlakon: boolean,
    slotFrom = at,
  ) => {
    const customer = source === 'bot' || random() < 0.35 ? pick(customers) : undefined;
    const fulfillment: Fulfillment = source === 'bot' && random() < 0.4 ? 'delivery' : 'pickup';
    const cashierId = pick(cashiers);
    const slot = source === 'bot' ? slotFor(slotFrom) : null;

    const chain: OrderStatus[] =
      source === 'pos'
        ? ['done']
        : wanted === 'cancelled'
          ? ['new', 'cancelled']
          : FLOW.slice(0, FLOW.indexOf(wanted) + 1);
    const times: number[] = [];
    let stepAt = at;
    for (const step of chain) {
      if (times.length > 0) stepAt += between(4, 25) * MINUTE;
      if (step === 'done' && slot) stepAt = Math.max(stepAt, slotStart(slot) + between(0, 50) * MINUTE);
      times.push(stepAt);
    }
    if (source === 'bot' && chain[chain.length - 1] === 'done' && times[times.length - 1] > now) {
      chain.pop();
      times.pop();
    }
    const status = chain[chain.length - 1];

    const number = await nextCounter(em, 'order');
    const address = fulfillment === 'delivery' ? pick(ADDRESSES) : null;
    const lines = makeLines(withFlakon);
    const deliveryFee = fulfillment === 'delivery' ? pick([15_000, 20_000, 25_000, 30_000]) : 0;
    const payment = status === 'done' ? pick(PAYMENTS) : null;
    const order: Order = {
      id: `o-${number}`,
      number,
      source,
      createdAt: time(at),
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? 'Mijoz',
      customerPhone: customer?.phone ?? '',
      fulfillment,
      address,
      slot,
      comment: null,
      lines,
      deliveryFee,
      status,
      payment,
      cashierId: source === 'pos' || status !== 'new' ? cashierId : null,
      history: [],
      stockApplied: false,
    };
    for (const [index, step] of chain.entries()) {
      const stepTime = time(times[index]);
      const userId = step === 'new' && source === 'bot' ? undefined : cashierId;
      order.history.push({ status: step, at: stepTime.toISOString(), ...(userId && { userId }) });
      if (step === 'ready' || (step === 'done' && source === 'pos'))
        await orders.applyOrderStock(em, order, cashierId, stepTime);
    }
    await em.insert(Order, order);
    created.push(order);
  };

  /** Spisanie: atir quyish paytida to'kildi (o'sha kunning savdosi bilan birga). */
  const addWriteOff = async (at: number) => {
    const date = time(at);
    await warehouse.insertWriteOff(
      em,
      {
        date: toDateKey(date),
        reason: 'spill',
        lines: [{ key: stockKey('gram', products[0].id), qty: 30 }],
        note: "Quyish paytida to'kildi",
      },
      admin,
      date,
    );
  };

  /** Inventarizatsiya: oltita atirning razlivi sanaldi — farq shu vaqt bilan yoziladi. */
  const addInventory = async (at: number) => {
    const date = time(at);
    const inventoryKeys = products.slice(0, 6).map((product) => stockKey('gram', product.id));
    const balances = await stock.balances(em, inventoryKeys);
    const lines = inventoryKeys.map((key) => ({
      key,
      actual: Math.max(0, balances.get(key)!.qty + pick([0, 0, -10, -20, 10])),
    }));
    await warehouse.insertInventory(
      em,
      { date: toDateKey(date), lines, note: 'Haftalik sanoq' },
      admin,
      date,
    );
  };

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    // har kuni ertalab: qoldig'i kamaygan pozitsiyalar to'ldiriladi (oxirgi kunlardagi prixod — qarzga)
    const balances = await stock.balances(em, keys);
    const low = keys.filter((key) => {
      const { kind } = parseStockKey(key)!;
      const { qty } = balances.get(key)!;
      return kind === 'gram' ? qty < 700 : kind === 'bottle' ? qty < 2 : qty < 60;
    });
    if (low.length > 0) {
      const qtyOf = (key: StockKey) => {
        const kind = parseStockKey(key)!.kind;
        const { qty } = balances.get(key)!;
        return kind === 'gram'
          ? between(10, 20) * 100 - Math.min(0, qty)
          : kind === 'bottle'
            ? between(2, 5)
            : between(100, 200);
      };
      // bugun hali soat 10 bo'lmagan bo'lsa — hozirdan biroz oldin (kelajakdagi prixod bo'lmasin)
      await purchase(
        Math.min(dayStart(daysAgo) + 10 * HOUR, now - 10 * MINUTE),
        low,
        qtyOf,
        daysAgo <= 3 ? 0 : daysAgo <= 12 ? 0.5 : 1,
      );
    }
    const weekend = [0, 6].includes(new Date(dayStart(daysAgo)).getDay());
    const count = between(4, 8) + (weekend ? 3 : 0);
    const times = Array.from(
      { length: count },
      () => dayStart(daysAgo) + between(10 * 60, 21 * 60 + 30) * MINUTE,
    )
      .filter((value) => value < now - 2 * HOUR)
      .sort((a, b) => a - b);
    for (const at of times) {
      const source: OrderSource = random() < 0.42 ? 'bot' : 'pos';
      await addOrder(at, source, source === 'bot' && random() < 0.06 ? 'cancelled' : 'done', true);
    }
    if (daysAgo === 10) await addWriteOff(dayStart(10) + 15 * HOUR);
    if (daysAgo === 5) await addInventory(dayStart(5) + 20 * HOUR);
  }

  // ───── faol bot buyurtmalari (kassa navbati): eskisidan yangisiga ─────
  const live: [OrderStatus, number, number][] = [
    ['ready', 95, 118],
    ['preparing', 65, 90],
    ['accepted', 40, 60],
    ['new', 18, 35],
    ['new', 3, 15],
  ];
  for (const [status, from, to] of live) {
    await addOrder(now - between(from, to) * MINUTE, 'bot', status, status === 'ready', now);
  }

  // ───── chiqimlar ─────
  const expenses: Expense[] = [];
  const expense = (
    daysAgo: number,
    categoryId: string,
    amount: number,
    payment: PaymentType,
    note: string,
  ) => {
    const createdAt = time(dayStart(daysAgo) + 12 * HOUR);
    expenses.push({
      id: `ex-${expenses.length + 1}`,
      date: toDateKey(createdAt),
      categoryId,
      amount,
      payment,
      note,
      userId: admin,
      createdAt,
    });
  };
  expense(27, 'rent', 8_000_000, 'card', "Do'kon ijarasi");
  expense(26, 'utilities', 650_000, 'click', 'Elektr va suv');
  expense(20, 'ads', 1_500_000, 'card', 'Instagram reklama');
  expense(15, 'salary', 6_000_000, 'cash', 'Kassirlar — avans');
  expense(1, 'salary', 6_000_000, 'cash', 'Kassirlar — oylik');
  expense(6, 'ads', 900_000, 'card', 'Telegram kanal');
  expense(3, 'other', 240_000, 'cash', 'Qadoqlash lentasi');
  for (const daysAgo of [25, 18, 11, 4])
    expense(daysAgo, 'courier', between(3, 6) * 50_000, 'cash', 'Kuryerlar haftalik');
  await em.insert(Expense, expenses);

  // ───── sharhlar (berilgan bot buyurtmalaridan) ─────
  const reviewed = new Set<string>();
  const reviews: Review[] = [];
  for (const order of created) {
    if (order.source !== 'bot' || order.status !== 'done' || !order.customerId || random() > 0.45) continue;
    const line = order.lines[0];
    const key = `${order.customerId}:${line.productId}`;
    if (reviewed.has(key)) continue;
    reviewed.add(key);
    reviews.push({
      id: `r-${reviews.length + 1}`,
      productId: line.productId,
      customerId: order.customerId,
      name: order.customerName.split(' ')[0],
      rating: random() < 0.75 ? 5 : 4,
      text: pick(REVIEW_TEXTS),
      createdAt: time(Math.min(now, order.createdAt.getTime() + between(1, 3) * DAY)),
      hidden: false,
    });
  }
  if (reviews.length) await em.insert(Review, reviews);
}
