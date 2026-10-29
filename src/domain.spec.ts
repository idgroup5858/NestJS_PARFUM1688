import { createHmac } from 'node:crypto';
import { isDateKey } from './common/dates';
import { normalizePhone, isUzPhone, formatOrderNumber, formatPhone } from './common/format';
import { slugify, uniqueId } from './common/ids';
import type { Order } from './orders/order.entity';
import { canMoveTo, orderCost, orderStockNeeds, orderTotals } from './orders/order-logic';
import { slotAvailable } from './shop/slots';
import { parseStockKey } from './stock/stock-key';
import { INIT_DATA_MAX_AGE_SEC, verifyInitData } from './telegram/init-data';

const BOT_TOKEN = '123456789:AAHfakeTokenForTestsOnly_abcdefghijk';

/** Telegram'ning o'zi kabi imzolangan initData. */
function signedInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const checkString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe('Telegram initData', () => {
  const now = Date.UTC(2026, 9, 29, 12);
  const authDate = String(Math.floor(now / 1000) - 60);
  const user = JSON.stringify({ id: 42, first_name: 'Laylo', language_code: 'uz' });

  it("to'g'ri imzo — foydalanuvchi", () => {
    expect(
      verifyInitData(signedInitData({ auth_date: authDate, user, query_id: 'q1' }), BOT_TOKEN, now)?.id,
    ).toBe(42);
  });

  it('boshqa bot tokeni bilan imzolangan — rad', () => {
    expect(
      verifyInitData(
        signedInitData({ auth_date: authDate, user }, '987654321:BBotherToken_xxxxxxxxxxxxxxxxxxxxx'),
        BOT_TOKEN,
        now,
      ),
    ).toBeNull();
  });

  it("o'zgartirilgan foydalanuvchi — rad", () => {
    const data = signedInitData({ auth_date: authDate, user }).replace('Laylo', 'Hacker');
    expect(verifyInitData(data, BOT_TOKEN, now)).toBeNull();
  });

  it('eskirgan — rad', () => {
    const old = String(Math.floor(now / 1000) - INIT_DATA_MAX_AGE_SEC - 1);
    expect(verifyInitData(signedInitData({ auth_date: old, user }), BOT_TOKEN, now)).toBeNull();
  });

  it('imzosiz — rad', () => {
    expect(
      verifyInitData(`auth_date=${authDate}&user=${encodeURIComponent(user)}`, BOT_TOKEN, now),
    ).toBeNull();
  });
});

describe('buyurtma holatlari', () => {
  it('faqat oldinga yoki bekor', () => {
    expect(canMoveTo('new', 'accepted')).toBe(true);
    expect(canMoveTo('accepted', 'ready')).toBe(true);
    expect(canMoveTo('ready', 'done')).toBe(true);
    expect(canMoveTo('preparing', 'cancelled')).toBe(true);
    expect(canMoveTo('ready', 'accepted')).toBe(false);
    expect(canMoveTo('new', 'new')).toBe(false);
  });

  it("yopilgan buyurtma o'zgarmaydi", () => {
    expect(canMoveTo('done', 'cancelled')).toBe(false);
    expect(canMoveTo('cancelled', 'new')).toBe(false);
  });
});

describe('buyurtma summalari', () => {
  const order = {
    deliveryFee: 20_000,
    lines: [
      {
        id: 'l-1',
        productId: 'a',
        kind: 'gram',
        name: 'A',
        qty: 50,
        unitPrice: 2_000,
        unitCost: 800,
        flakon: { flakonId: 'fl-50', paid: true, price: 15_000, unitCost: 4_500 },
      },
      {
        id: 'l-2',
        productId: 'a',
        kind: 'gram',
        name: 'A',
        qty: 100,
        unitPrice: 2_000,
        unitCost: 800,
        flakon: { flakonId: 'fl-100', paid: false, price: 25_000, unitCost: 7_500 },
      },
      {
        id: 'l-3',
        productId: 'b',
        kind: 'bottle',
        name: 'B',
        qty: 1,
        unitPrice: 1_850_000,
        unitCost: 1_332_000,
        volumeMl: 100,
      },
    ],
  } as Pick<Order, 'lines' | 'deliveryFee'>;

  it('jami: atir + pullik tara + yetkazish (tekin tara — summaga kirmaydi)', () => {
    expect(orderTotals(order)).toEqual({
      goods: 2_150_000,
      flakons: 15_000,
      delivery: 20_000,
      total: 2_185_000,
    });
  });

  it('tannarx: tekin tara ham kiradi', () => {
    expect(orderCost(order)).toBe(150 * 800 + 4_500 + 7_500 + 1_332_000);
  });

  it("omborga ehtiyoj: bir atirning qatorlari qo'shiladi, tara alohida", () => {
    expect([...orderStockNeeds(order.lines)]).toEqual([
      ['gram:a', 150],
      ['flakon:fl-50', 1],
      ['flakon:fl-100', 1],
      ['bottle:b', 1],
    ]);
  });
});

describe('yetkazish vaqti', () => {
  // 29-oktabr, 14:30 (server vaqt zonasida)
  const now = new Date(2026, 9, 29, 14, 30);

  it('bugun — faqat kelmagan soatlar', () => {
    expect(slotAvailable('2026-10-29', 14, now)).toBe(false);
    expect(slotAvailable('2026-10-29', 15, now)).toBe(true);
  });

  it("ertaga va indinga — hamma soat (10–21), undan keyin — yo'q", () => {
    expect(slotAvailable('2026-10-30', 10, now)).toBe(true);
    expect(slotAvailable('2026-10-31', 21, now)).toBe(true);
    expect(slotAvailable('2026-11-01', 12, now)).toBe(false);
    expect(slotAvailable('2026-10-30', 22, now)).toBe(false);
    expect(slotAvailable('2026-10-30', 9, now)).toBe(false);
  });

  it("o'tgan kun va noto'g'ri sana — yo'q", () => {
    expect(slotAvailable('2026-10-28', 15, now)).toBe(false);
    expect(slotAvailable('2026-02-30', 15, now)).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
  });
});

describe('yordamchilar', () => {
  it('telefon', () => {
    expect(normalizePhone('90 123 45 67')).toBe('998901234567');
    expect(normalizePhone('+998 (90) 123-45-67')).toBe('998901234567');
    expect(isUzPhone('998901234567')).toBe(true);
    expect(isUzPhone('99890123456')).toBe(false);
    expect(formatPhone('998901234567')).toBe('+998 90 123 45 67');
  });

  it('id lar (frontend uniqueId bilan bir xil)', () => {
    expect(slugify("Louis Vuitton L'Immensité")).toBe('louis-vuitton-limmensit');
    expect(uniqueId('Dior Sauvage', ['dior-sauvage', 'dior-sauvage-2'])).toBe('dior-sauvage-3');
    expect(uniqueId('Атир', [], 'prd')).toMatch(/^prd_[0-9a-f]{16}$/);
  });

  it('ombor kaliti', () => {
    expect(parseStockKey('gram:dior-sauvage')).toEqual({ kind: 'gram', id: 'dior-sauvage' });
    expect(parseStockKey('box:x')).toBeNull();
    expect(parseStockKey('gram:')).toBeNull();
  });

  it('buyurtma raqami', () => {
    expect(formatOrderNumber(7)).toBe('#0007');
  });
});
