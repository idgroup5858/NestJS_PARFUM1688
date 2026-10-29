import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Flakon, Product } from '../catalog/entities';
import { newId } from '../common/ids';
import type { MovementReason } from '../common/types';
import { Order } from '../orders/order.entity';
import { ShopSettings } from '../settings/settings.service';
import { InventoryCount, WriteOff } from '../warehouse/warehouse.entities';
import { parseStockKey, stockKey, stockUnit, type StockKey } from './stock-key';
import { StockMovement } from './stock.entities';

export interface Balance {
  qty: number;
  avgCost: number;
}

export interface MovementOptions {
  refId?: string;
  userId?: string;
  at?: Date;
}

/**
 * Ombor qoldig'i va harakatlari (frontend `domain/stock.ts` mantig'i). Hamma funksiya tranzaksiya ichida chaqiriladi:
 * avval [lock] (barcha kalitlar, bir xil tartibda — ikki tranzaksiya bir-birini kutib qolmasin), keyin kirim / chiqim.
 * Qoldiq manfiy bo'lishi mumkin (savdo to'xtamaydi) — kassa va admin oldindan ogohlantiradi.
 */
@Injectable()
export class StockService {
  /** Pozitsiyalarni qulflaydi (qatori bo'lmasa — 0 qoldiq bilan yaratiladi). */
  async lock(em: EntityManager, keys: Iterable<StockKey>): Promise<void> {
    const sorted = [...new Set(keys)].sort();
    if (sorted.length === 0) return;
    await em.query(
      `INSERT INTO stock ("key", "qty", "avgCost") SELECT k, 0, 0 FROM unnest($1::varchar[]) AS k
       ON CONFLICT ("key") DO NOTHING`,
      [sorted],
    );
    await em.query(`SELECT "key" FROM stock WHERE "key" = ANY($1::varchar[]) ORDER BY "key" FOR UPDATE`, [
      sorted,
    ]);
  }

  async balance(em: EntityManager, key: StockKey): Promise<Balance> {
    const rows: Balance[] = await em.query(`SELECT "qty", "avgCost" FROM stock WHERE "key" = $1`, [key]);
    return rows[0] ?? { qty: 0, avgCost: 0 };
  }

  /** Bir nechta pozitsiya qoldig'i (yo'qlari — 0). */
  async balances(em: EntityManager, keys: Iterable<StockKey>): Promise<Map<StockKey, Balance>> {
    const list = [...new Set(keys)];
    const result = new Map<StockKey, Balance>(list.map((key) => [key, { qty: 0, avgCost: 0 }]));
    if (list.length === 0) return result;
    const rows: (Balance & { key: StockKey })[] = await em.query(
      `SELECT "key", "qty", "avgCost" FROM stock WHERE "key" = ANY($1::varchar[])`,
      [list],
    );
    for (const row of rows) result.set(row.key, { qty: row.qty, avgCost: row.avgCost });
    return result;
  }

  /** Kirim: qoldiq oshadi, o'rtacha tannarx qayta hisoblanadi. Prixod tannarxi kutilayotgan chiqimlarga ham yoziladi. */
  async stockIn(
    em: EntityManager,
    key: StockKey,
    qty: number,
    unitCost: number,
    reason: MovementReason,
    options: MovementOptions = {},
  ): Promise<void> {
    if (qty <= 0) return;
    const current = await this.balance(em, key);
    const base = Math.max(0, current.qty);
    const avgCost =
      base + qty > 0 ? Math.round((base * current.avgCost + qty * unitCost) / (base + qty)) : unitCost;
    await this.write(em, key, { qty: current.qty + qty, avgCost });
    await this.record(em, key, qty, unitCost, reason, options, false);
    if ((reason === 'purchase' || reason === 'initial') && unitCost > 0)
      await this.settlePendingCost(em, key, unitCost);
  }

  /**
   * Chiqim o'rtacha tannarxda. Qaytaradi: 1 birlik tannarxi (hujjat qatoriga yoziladi). Pozitsiya hali bir marta ham
   * kirim qilinmagan bo'lsa (tannarx 0), harakat "tannarx kutilmoqda" bo'lib yoziladi — keyingi prixod narxi shu
   * chiqimga va uning hujjatiga yoziladi (foyda tannarxsiz "100%" bo'lib qolmaydi).
   */
  async stockOut(
    em: EntityManager,
    key: StockKey,
    qty: number,
    reason: MovementReason,
    options: MovementOptions = {},
  ): Promise<number> {
    const current = await this.balance(em, key);
    if (qty <= 0) return current.avgCost;
    await this.write(em, key, { qty: current.qty - qty, avgCost: current.avgCost });
    await this.record(em, key, -qty, current.avgCost, reason, options, current.avgCost === 0);
    return current.avgCost;
  }

  /** Inventarizatsiya: qoldiqni sanalgan qiymatga keltiradi (farq harakat sifatida yoziladi). */
  async stockSet(
    em: EntityManager,
    key: StockKey,
    actual: number,
    options: MovementOptions = {},
  ): Promise<void> {
    const current = await this.balance(em, key);
    const diff = actual - current.qty;
    if (diff === 0) return;
    await this.write(em, key, { qty: actual, avgCost: current.avgCost });
    await this.record(
      em,
      key,
      diff,
      current.avgCost,
      'inventory',
      options,
      diff < 0 && current.avgCost === 0,
    );
  }

  /** Tannarxi kutilayotgan chiqim(lar) — bekor qilingan buyurtma uchun kerak emas (tovar omborga qaytdi). */
  async clearPendingCost(em: EntityManager, refId: string): Promise<void> {
    await em.query(`UPDATE stock_movements SET "costPending" = false WHERE "refId" = $1 AND "costPending"`, [
      refId,
    ]);
  }

  /**
   * Ombordagi barcha pozitsiyalar: har atirning razlivi, original flakoni (sotilsa) va taralar. Original sotuvdan
   * olingan atirning omborda qolgan (yoki manfiy) flakonlari ham kiradi.
   */
  async allKeys(em: EntityManager): Promise<StockKey[]> {
    const products = await em.find(Product, { select: { id: true, bottle: true } });
    const flakons = await em.find(Flakon, { select: { id: true } });
    const keys: StockKey[] = [];
    for (const product of products) {
      keys.push(stockKey('gram', product.id));
      if (product.bottle) keys.push(stockKey('bottle', product.id));
    }
    for (const flakon of flakons) keys.push(stockKey('flakon', flakon.id));
    const listed = new Set(keys);
    const productIds = new Set(products.map((product) => product.id));
    const flakonIds = new Set(flakons.map((flakon) => flakon.id));
    const rows: { key: StockKey }[] = await em.query(`SELECT "key" FROM stock WHERE "qty" <> 0`);
    for (const { key } of rows) {
      const parsed = parseStockKey(key);
      if (!parsed || listed.has(key)) continue;
      const exists = parsed.kind === 'flakon' ? flakonIds.has(parsed.id) : productIds.has(parsed.id);
      if (exists) keys.push(key);
    }
    return keys;
  }

  /** Pozitsiya egasi katalogda bormi (prixod / spisanie / inventarizatsiya qatorlari uchun). */
  async missingOwners(em: EntityManager, keys: StockKey[]): Promise<StockKey[]> {
    const productIds = new Set<string>();
    const flakonIds = new Set<string>();
    for (const key of keys) {
      const parsed = parseStockKey(key);
      if (!parsed) continue;
      (parsed.kind === 'flakon' ? flakonIds : productIds).add(parsed.id);
    }
    const products = productIds.size
      ? await em.find(Product, { where: { id: In([...productIds]) }, select: { id: true } })
      : [];
    const flakons = flakonIds.size
      ? await em.find(Flakon, { where: { id: In([...flakonIds]) }, select: { id: true } })
      : [];
    const foundProducts = new Set(products.map((item) => item.id));
    const foundFlakons = new Set(flakons.map((item) => item.id));
    return keys.filter((key) => {
      const parsed = parseStockKey(key);
      if (!parsed) return true;
      return parsed.kind === 'flakon' ? !foundFlakons.has(parsed.id) : !foundProducts.has(parsed.id);
    });
  }

  private async write(em: EntityManager, key: StockKey, balance: Balance): Promise<void> {
    await em.query(
      `INSERT INTO stock ("key", "qty", "avgCost") VALUES ($1, $2, $3)
       ON CONFLICT ("key") DO UPDATE SET "qty" = EXCLUDED."qty", "avgCost" = EXCLUDED."avgCost"`,
      [key, balance.qty, balance.avgCost],
    );
  }

  private async record(
    em: EntityManager,
    key: StockKey,
    qty: number,
    unitCost: number,
    reason: MovementReason,
    options: MovementOptions,
    costPending: boolean,
  ): Promise<void> {
    await em.insert(StockMovement, {
      id: newId('mov'),
      at: options.at ?? new Date(),
      key,
      qty,
      unitCost,
      reason,
      refId: options.refId ?? null,
      userId: options.userId ?? null,
      costPending,
    });
  }

  /** Tannarxsiz chiqimlarga birinchi ma'lum prixod narxini yozadi (harakat va hujjat qatorlari). */
  private async settlePendingCost(em: EntityManager, key: StockKey, unitCost: number): Promise<void> {
    const [rows] = (await em.query(
      `UPDATE stock_movements SET "costPending" = false, "unitCost" = $2
       WHERE "key" = $1 AND "costPending" RETURNING "reason", "refId"`,
      [key, unitCost],
    )) as [{ reason: MovementReason; refId: string | null }[], number];
    const refs = new Map<string, MovementReason>();
    for (const row of rows) if (row.refId) refs.set(row.refId, row.reason);

    for (const [refId, reason] of refs) {
      if (reason === 'sale') {
        const order = await em.findOne(Order, { where: { id: refId }, lock: { mode: 'pessimistic_write' } });
        if (!order) continue;
        let changed = false;
        for (const line of order.lines) {
          if (stockKey(line.kind, line.productId) === key && !line.unitCost) {
            line.unitCost = unitCost;
            changed = true;
          }
          if (line.flakon && stockKey('flakon', line.flakon.flakonId) === key && !line.flakon.unitCost) {
            line.flakon.unitCost = unitCost;
            changed = true;
          }
        }
        if (changed) await em.update(Order, order.id, { lines: order.lines });
      } else if (reason === 'writeoff' || reason === 'inventory') {
        const entity = reason === 'writeoff' ? WriteOff : InventoryCount;
        const doc = await em.findOne<WriteOff | InventoryCount>(entity, {
          where: { id: refId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!doc) continue;
        let changed = false;
        for (const line of doc.lines) {
          if (line.key === key && !line.unitCost) {
            line.unitCost = unitCost;
            changed = true;
          }
        }
        if (changed) await em.update(entity, doc.id, { lines: doc.lines });
      }
    }
  }
}

/** Sotuvdagi pozitsiyami: faol atirning razlivi, faol atirning original flakoni (sotilsa) va faol tara. */
export function isOnSale(
  key: StockKey,
  products: Map<string, Product>,
  flakons: Map<string, Flakon>,
): boolean {
  const parsed = parseStockKey(key);
  if (!parsed) return false;
  if (parsed.kind === 'flakon') return flakons.get(parsed.id)?.active ?? false;
  const product = products.get(parsed.id);
  return !!product && product.active && (parsed.kind === 'gram' || !!product.bottle);
}

/** Kam qoldimi (sotuvda bo'lmagan pozitsiya hech qachon "kam" emas). */
export function isLowStock(key: StockKey, qty: number, onSale: boolean, settings: ShopSettings): boolean {
  if (!onSale) return false;
  return stockUnit(key) === 'g' ? qty < settings.lowStockGrams : qty < settings.lowStockPieces;
}
