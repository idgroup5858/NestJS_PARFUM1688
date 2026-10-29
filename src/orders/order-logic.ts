import type { OrderStatus } from '../common/types';
import { stockKey, type StockKey } from '../stock/stock-key';
import type { Order, OrderLine } from './order.entity';

/** Buyurtma summalari (frontend `orderTotals` bilan bir xil). Yetkazish narxi foydaga kirmaydi (kuryerga ketadi). */
export function orderTotals(order: Pick<Order, 'lines' | 'deliveryFee'>) {
  const goods = order.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const flakons = order.lines.reduce((sum, line) => sum + (line.flakon?.paid ? line.flakon.price : 0), 0);
  const delivery = order.deliveryFee;
  return { goods, flakons, delivery, total: goods + flakons + delivery };
}

/** Tannarx: atir (grammi / donasi) + tara (tekin berilsa ham). Ombordan chiqarilmagan bo'lsa — 0. */
export function orderCost(order: Pick<Order, 'lines'>): number {
  return order.lines.reduce(
    (sum, line) => sum + line.qty * (line.unitCost ?? 0) + (line.flakon?.unitCost ?? 0),
    0,
  );
}

/** Kassadagi navbat: new → accepted → preparing → ready → done. */
export const FLOW: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'done'];
export const ACTIVE_STATUSES: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready'];

export function isFinished(status: OrderStatus): boolean {
  return status === 'done' || status === 'cancelled';
}

/**
 * Holat o'zgarishi mumkinmi: faqat oldinga (bosqich tashlab o'tish mumkin — "Tayyor" dan to'g'ridan-to'g'ri "Berildi")
 * yoki bekor qilish. Orqaga qaytish yo'q (ombordan chiqgan tovar qaytmay qolardi). Yopilgan buyurtma o'zgarmaydi —
 * faqat admin berilgan buyurtmani bekor qila oladi (tovar omborga qaytadi, savdodan chiqadi; admin → Buyurtmalar).
 */
export function canMoveTo(current: OrderStatus, next: OrderStatus, admin = false): boolean {
  if (current === 'done' && next === 'cancelled') return admin;
  if (isFinished(current) || current === next) return false;
  if (next === 'cancelled') return true;
  return FLOW.indexOf(next) > FLOW.indexOf(current);
}

/** Buyurtma ombordan nima oladi: har qator o'z kaliti, tara — alohida (1 dona). */
export function orderStockNeeds(lines: OrderLine[]): Map<StockKey, number> {
  const need = new Map<StockKey, number>();
  for (const line of lines) {
    const key = stockKey(line.kind, line.productId);
    need.set(key, (need.get(key) ?? 0) + line.qty);
    if (line.flakon) {
      const flakonKey = stockKey('flakon', line.flakon.flakonId);
      need.set(flakonKey, (need.get(flakonKey) ?? 0) + 1);
    }
  }
  return need;
}
