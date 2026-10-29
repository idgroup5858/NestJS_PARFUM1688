import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, LessThan, MoreThanOrEqual, And } from 'typeorm';
import type { AuthUser } from '../auth/auth.types';
import { Flakon, Product } from '../catalog/entities';
import { addDays, startOfDay } from '../common/dates';
import { fail } from '../common/errors';
import { isUzPhone, normalizePhone } from '../common/format';
import { newId } from '../common/ids';
import type { Fulfillment, OrderStatus } from '../common/types';
import { Customer } from '../customers/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { nextCounter } from '../database/counters';
import { transaction } from '../database/transaction';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { stockKey } from '../stock/stock-key';
import { StockService } from '../stock/stock.service';
import { TelegramNotifier } from '../telegram/notifier.service';
import { Order, OrderLine, OrderSlot } from './order.entity';
import { ACTIVE_STATUSES, canMoveTo, isFinished, orderStockNeeds } from './order-logic';
import { OrdersQuery, PosSaleDto, UpdateOrderDto } from './order.dto';

export type OrderDraft = Omit<Order, 'id' | 'number' | 'createdAt' | 'history' | 'stockApplied'>;

export interface LineInput {
  productId: string;
  kind: 'gram' | 'bottle';
  qty: number;
  flakon?: { flakonId: string; paid: boolean };
}

export interface ShopOrderInput {
  name: string;
  phone: string;
  fulfillment: Fulfillment;
  address?: string;
  slot: OrderSlot;
  comment?: string;
  lines: LineInput[];
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stock: StockService,
    private readonly customers: CustomersService,
    private readonly realtime: RealtimeGateway,
    private readonly notifier: TelegramNotifier,
  ) {}

  // ───────────────────────── o'qish ─────────────────────────

  list(query: OrdersQuery): Promise<Order[]> {
    const statuses = query.active ? ACTIVE_STATUSES : query.status;
    const from = query.from ? startOfDay(query.from) : undefined;
    const to = query.to ? startOfDay(addDays(query.to, 1)) : undefined;
    const createdAt =
      from && to
        ? And(MoreThanOrEqual(from), LessThan(to))
        : from
          ? MoreThanOrEqual(from)
          : to
            ? LessThan(to)
            : undefined;
    const where: FindOptionsWhere<Order> = {
      ...(statuses?.length && { status: In(statuses) }),
      ...(query.source && { source: query.source }),
      ...(query.customerId && { customerId: query.customerId }),
      ...(createdAt && { createdAt }),
    };
    return this.dataSource.manager.find(Order, {
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 1000,
    });
  }

  async get(id: string): Promise<Order> {
    return (await this.dataSource.manager.findOneBy(Order, { id })) ?? fail('not_found', `order ${id}`);
  }

  // ───────────────────────── amallar ─────────────────────────

  /** Kassa sotuvi: mijoz (raqami bo'lsa), narxlar bazadan, darhol "Berildi" — tovar shu zahoti ombordan chiqadi. */
  async createPosSale(dto: PosSaleDto, user: AuthUser): Promise<Order> {
    const phone = normalizePhone(dto.phone ?? '');
    if (phone && !isUzPhone(phone)) fail('phone_invalid', phone);
    const name = dto.name ?? '';
    const order = await transaction(this.dataSource, async (em) => {
      const lines = await this.buildLines(em, dto.lines);
      const customer = await this.customers.forPosSale(em, { name, phone });
      return this.insertOrder(
        em,
        {
          source: 'pos',
          customerId: customer?.id ?? null,
          customerName: name || customer?.name || 'Mijoz',
          customerPhone: phone,
          fulfillment: 'pickup',
          address: null,
          slot: null,
          comment: null,
          lines,
          deliveryFee: 0,
          status: 'done',
          payment: dto.payment,
          cashierId: user.id,
        },
        user.id,
      );
    });
    this.after(order, null, true);
    return order;
  }

  /**
   * Mijoz ilovasidan buyurtma: kassa navbatiga "Yangi" bo'lib tushadi (tovar hali chiqmaydi — "Tayyor" da). To'lov
   * qabul qilishda, yetkazish narxini kassir telefonda kelishadi. [device] — mijoz qurilmasi sessiyasi.
   */
  async createShopOrder(
    input: ShopOrderInput,
    device: { customerId: string | null; telegramId: number | null },
  ): Promise<{ order: Order; customer: Customer }> {
    const result = await transaction(this.dataSource, async (em) => {
      const lines = await this.buildLines(
        em,
        input.lines.map(({ flakon: _flakon, ...line }) => line),
      );
      const customer = await this.customers.forShopOrder(em, device, {
        name: input.name,
        phone: input.phone,
      });
      const order = await this.insertOrder(em, {
        source: 'bot',
        customerId: customer.id,
        customerName: input.name,
        customerPhone: input.phone,
        fulfillment: input.fulfillment,
        address: input.fulfillment === 'delivery' ? (input.address ?? null) : null,
        slot: input.slot,
        comment: input.comment ?? null,
        lines,
        deliveryFee: 0,
        status: 'new',
        payment: null,
        cashierId: null,
      });
      return { order, customer };
    });
    this.after(result.order, null, false);
    return result;
  }

  /**
   * Kassa oynasi: tara (tovar ombordan chiqmaguncha), yetkazish narxi, to'lov turi va ixtiyoriy yangi holat. "Tayyor"
   * yoki "Berildi" — atir va tara ombordan chiqadi, "Bekor qilindi" — qaytadi. "Berildi" uchun to'lov turi shart.
   */
  async update(id: string, dto: UpdateOrderDto, user: AuthUser): Promise<Order> {
    const { order, previous, stockMoved } = await transaction(this.dataSource, async (em) => {
      const target =
        (await em.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } })) ??
        fail('not_found', `order ${id}`);
      const before = target.status;
      const admin = user.role === 'admin';
      // berilgan buyurtmani bekor qilish (faqat admin) — boshqa maydonlar o'zgarmaydi
      const revoking = target.status === 'done' && dto.status === 'cancelled' && admin;
      if (isFinished(target.status) && !revoking) fail('order_finished');

      if (!revoking) {
        if (dto.flakons?.length) {
          if (target.stockApplied) fail('lines_locked');
          await this.applyFlakonPicks(em, target, dto.flakons);
        }
        if (dto.deliveryFee !== undefined) target.deliveryFee = dto.deliveryFee;
        if (dto.payment) target.payment = dto.payment;
      }

      let moved = false;
      if (dto.status && dto.status !== target.status) {
        if (!canMoveTo(target.status, dto.status, admin))
          fail('invalid_status', `${target.status} → ${dto.status}`);
        if (dto.status === 'done' && !target.payment) fail('payment_required');
        const applied = target.stockApplied;
        await this.applyStatus(em, target, dto.status, user.id);
        moved = applied !== target.stockApplied;
      }
      await em.update(Order, target.id, {
        lines: target.lines,
        deliveryFee: target.deliveryFee,
        payment: target.payment,
        status: target.status,
        cashierId: target.cashierId,
        history: target.history,
        stockApplied: target.stockApplied,
      });
      return { order: target, previous: before, stockMoved: moved };
    });
    this.after(order, previous, stockMoved);
    return order;
  }

  // ───────────────────────── yadro (tranzaksiya ichida; demo tarix ham shulardan) ─────────────────────────

  /**
   * Yangi buyurtma: raqam, vaqt va tarix qo'yiladi; original qatoriga flakon hajmi yoziladi (keyin atirda o'zgarsa ham
   * chekda to'g'ri qoladi). "Tayyor" / "Berildi" bo'lib yaratilsa — tovar shu zahoti ombordan chiqadi.
   */
  async insertOrder(em: EntityManager, draft: OrderDraft, userId?: string, at = new Date()): Promise<Order> {
    const order: Order = {
      ...draft,
      id: newId('ord'),
      number: await nextCounter(em, 'order'),
      createdAt: at,
      history: [{ status: draft.status, at: at.toISOString(), ...(userId && { userId }) }],
      stockApplied: false,
    };
    if (order.status === 'ready' || order.status === 'done')
      await this.applyOrderStock(em, order, userId, at);
    await em.insert(Order, order);
    return order;
  }

  /**
   * Holatni o'zgartiradi (tekshiruvsiz — chaqiruvchi [canMoveTo] bilan tekshiradi): "Tayyor" yoki "Berildi" — tovar
   * ombordan chiqadi, "Bekor qilindi" — qaytadi. Bot buyurtmasini birinchi bo'lib olgan xodim — kassir.
   */
  async applyStatus(
    em: EntityManager,
    order: Order,
    status: OrderStatus,
    userId?: string,
    at = new Date(),
  ): Promise<void> {
    if (status === 'ready' || status === 'done') await this.applyOrderStock(em, order, userId, at);
    if (status === 'cancelled') await this.returnOrderStock(em, order, userId, at);
    order.status = status;
    if (userId && order.source === 'bot' && !order.cashierId && status !== 'cancelled')
      order.cashierId = userId;
    order.history = [...order.history, { status, at: at.toISOString(), ...(userId && { userId }) }];
  }

  /** Ombordan chiqarish: har qator o'z kaliti bo'yicha, tara — alohida. Qatorlarga tannarx yoziladi. */
  async applyOrderStock(em: EntityManager, order: Order, userId?: string, at = new Date()): Promise<void> {
    if (order.stockApplied) return;
    await this.stock.lock(em, orderStockNeeds(order.lines).keys());
    const options = { refId: order.id, userId, at };
    for (const line of order.lines) {
      line.unitCost = await this.stock.stockOut(
        em,
        stockKey(line.kind, line.productId),
        line.qty,
        'sale',
        options,
      );
      if (line.flakon) {
        line.flakon.unitCost = await this.stock.stockOut(
          em,
          stockKey('flakon', line.flakon.flakonId),
          1,
          'sale',
          options,
        );
      }
    }
    order.stockApplied = true;
  }

  /** Bekor qilinganda chiqarilgan tovar omborga qaytadi (o'sha tannarxda). */
  async returnOrderStock(em: EntityManager, order: Order, userId?: string, at = new Date()): Promise<void> {
    if (!order.stockApplied) return;
    await this.stock.lock(em, orderStockNeeds(order.lines).keys());
    const options = { refId: order.id, userId, at };
    for (const line of order.lines) {
      await this.stock.stockIn(
        em,
        stockKey(line.kind, line.productId),
        line.qty,
        line.unitCost ?? 0,
        'return',
        options,
      );
      if (line.flakon) {
        await this.stock.stockIn(
          em,
          stockKey('flakon', line.flakon.flakonId),
          1,
          line.flakon.unitCost ?? 0,
          'return',
          options,
        );
      }
    }
    // tovar qaytdi — tannarxi kutilayotgan chiqim endi yo'q
    await this.stock.clearPendingCost(em, order.id);
    order.stockApplied = false;
  }

  /**
   * Qatorlar joriy narx bilan ("muzlatiladi"): atir sotuvda bo'lishi, original qatorida atirning originali bo'lishi,
   * tara — faqat razliv qatorida va faol bo'lishi shart.
   */
  async buildLines(em: EntityManager, input: LineInput[]): Promise<OrderLine[]> {
    if (input.length === 0) fail('empty_order');
    const productIds = [...new Set(input.map((line) => line.productId))];
    const flakonIds = [...new Set(input.flatMap((line) => (line.flakon ? [line.flakon.flakonId] : [])))];
    const products = new Map(
      (await em.findBy(Product, { id: In(productIds) })).map((item) => [item.id, item]),
    );
    const flakons = new Map(
      (flakonIds.length ? await em.findBy(Flakon, { id: In(flakonIds) }) : []).map((item) => [item.id, item]),
    );
    return input.map((item, index) => {
      const product = products.get(item.productId);
      if (!product || !product.active) fail('product_unavailable', item.productId);
      if (item.kind === 'bottle' && !product.bottle)
        fail('product_unavailable', `${item.productId} (original)`);
      const line: OrderLine = {
        id: `l-${index + 1}`,
        productId: product.id,
        kind: item.kind,
        name: product.name,
        qty: item.qty,
        unitPrice: item.kind === 'gram' ? product.pricePerGram : product.bottle!.price,
        ...(item.kind === 'bottle' && { volumeMl: product.bottle!.volumeMl }),
      };
      if (item.flakon) {
        if (item.kind !== 'gram') fail('invalid_input', `lines.${index}.flakon: faqat razliv qatorida`);
        const flakon = flakons.get(item.flakon.flakonId);
        if (!flakon || !flakon.active) fail('flakon_unavailable', item.flakon.flakonId);
        line.flakon = { flakonId: flakon.id, paid: item.flakon.paid, price: flakon.price };
      }
      return line;
    });
  }

  private async applyFlakonPicks(
    em: EntityManager,
    order: Order,
    picks: { lineId: string; flakonId?: string | null; paid: boolean }[],
  ): Promise<void> {
    const ids = [...new Set(picks.flatMap((pick) => (pick.flakonId ? [pick.flakonId] : [])))];
    const flakons = new Map(
      (ids.length ? await em.findBy(Flakon, { id: In(ids) }) : []).map((item) => [item.id, item]),
    );
    const lines = order.lines.map((line) => ({ ...line }));
    for (const pick of picks) {
      const line = lines.find((item) => item.id === pick.lineId);
      if (!line) fail('not_found', `line ${pick.lineId}`);
      if (line.kind !== 'gram') fail('invalid_input', `${pick.lineId}: tara faqat razliv qatorida`);
      if (!pick.flakonId) {
        delete line.flakon;
        continue;
      }
      const flakon = flakons.get(pick.flakonId);
      if (!flakon || !flakon.active) fail('flakon_unavailable', pick.flakonId);
      line.flakon = { flakonId: flakon.id, paid: pick.paid, price: flakon.price };
    }
    order.lines = lines;
  }

  /** Tranzaksiyadan keyin: ekranlar va mijozga socket, Telegram xabarnomasi. [previous] = null — yangi buyurtma. */
  private after(order: Order, previous: OrderStatus | null, stockMoved: boolean): void {
    this.realtime.orderChanged(order);
    if (stockMoved) this.realtime.changed('stock');
    if (previous === null || previous !== order.status) this.notifier.orderChanged(order, previous);
  }
}
