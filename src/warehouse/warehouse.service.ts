import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { isDateKey, todayKey } from '../common/dates';
import { fail } from '../common/errors';
import { newId } from '../common/ids';
import type { WriteOffReason } from '../common/types';
import { nextCounter } from '../database/counters';
import { transaction } from '../database/transaction';
import type { StockKey } from '../stock/stock-key';
import { StockService } from '../stock/stock.service';
import { DocsQuery, PurchaseDto, SupplierDto, SupplierPaymentDto } from './warehouse.dto';
import {
  InventoryCount,
  Purchase,
  PurchaseLine,
  Supplier,
  SupplierPayment,
  WriteOff,
} from './warehouse.entities';

export interface PurchaseInput {
  supplierId: string;
  date: string;
  lines: PurchaseLine[];
  paid: number;
  note?: string | null;
}

export interface InventoryInput {
  date: string;
  lines: { key: StockKey; actual: number }[];
  note?: string | null;
}

export interface WriteOffInput {
  date: string;
  reason: WriteOffReason;
  lines: { key: StockKey; qty: number }[];
  note?: string | null;
}

/** Sana: haqiqiy va kelajakda emas (frontend `max={todayKey()}`). */
function checkDate(date: string): void {
  if (!isDateKey(date)) fail('invalid_input', `date ${date}`);
  if (date > todayKey()) fail('future_date', date);
}

/** "YYYY-MM-DD" oralig'i bo'yicha filtr (ikkala chegara ham kiradi). */
function dateRange(query: DocsQuery) {
  if (query.from && query.to) return Between(query.from, query.to);
  if (query.from) return MoreThanOrEqual(query.from);
  if (query.to) return LessThanOrEqual(query.to);
  return undefined;
}

/**
 * Ombor hujjatlari: yetkazib beruvchilar va to'lovlar, prixod (kirim), inventarizatsiya (sanoq), spisanie. Har hujjat
 * bitta tranzaksiyada: raqam + hujjat + ombor harakatlari (frontend `PurchaseFormModal`, `InventoryPage`,
 * `WriteOffsPage` mantig'i).
 */
@Injectable()
export class WarehouseService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stock: StockService,
  ) {}

  // ───────────────────────── yetkazib beruvchilar ─────────────────────────

  /** Har biri bilan: jami prixod, jami to'lov va qarz (prixod − to'lov). */
  async suppliers() {
    const suppliers = await this.dataSource.manager.find(Supplier, { order: { name: 'ASC' } });
    const totals: { supplierId: string; purchased: string; paid: string }[] = await this.dataSource.query(
      `SELECT s.id AS "supplierId",
              COALESCE((SELECT sum(total) FROM purchases p WHERE p."supplierId" = s.id), 0) AS purchased,
              COALESCE((SELECT sum(amount) FROM supplier_payments sp WHERE sp."supplierId" = s.id), 0) AS paid
       FROM suppliers s`,
    );
    const bySupplier = new Map(totals.map((row) => [row.supplierId, row]));
    return suppliers.map((supplier) => {
      const row = bySupplier.get(supplier.id);
      const purchased = Number(row?.purchased ?? 0);
      const paid = Number(row?.paid ?? 0);
      return { ...supplier, purchased, paid, debt: purchased - paid };
    });
  }

  async saveSupplier(id: string | null, dto: SupplierDto): Promise<Supplier> {
    const em = this.dataSource.manager;
    const data = { name: dto.name, phone: dto.phone, note: dto.note ?? null };
    if (id) {
      if (!(await em.existsBy(Supplier, { id }))) fail('not_found', `supplier ${id}`);
      await em.update(Supplier, id, data);
      return em.findOneByOrFail(Supplier, { id });
    }
    const supplier: Supplier = { id: newId('sup'), ...data, createdAt: new Date() };
    await em.insert(Supplier, supplier);
    return supplier;
  }

  async removeSupplier(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      if (!(await em.existsBy(Supplier, { id }))) fail('not_found', `supplier ${id}`);
      const used =
        (await em.existsBy(Purchase, { supplierId: id })) ||
        (await em.existsBy(SupplierPayment, { supplierId: id }));
      if (used) fail('in_use', 'purchases or payments');
      await em.delete(Supplier, id);
    });
  }

  payments(query: DocsQuery) {
    const where: FindOptionsWhere<SupplierPayment> = {
      ...(query.supplierId && { supplierId: query.supplierId }),
      ...(dateRange(query) && { date: dateRange(query) }),
    };
    return this.dataSource.manager.find(SupplierPayment, {
      where,
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  /** Qarzga to'lov (prixoddan alohida). */
  async createPayment(dto: SupplierPaymentDto, userId: string): Promise<SupplierPayment> {
    checkDate(dto.date);
    const em = this.dataSource.manager;
    if (!(await em.existsBy(Supplier, { id: dto.supplierId })))
      fail('not_found', `supplier ${dto.supplierId}`);
    const payment: SupplierPayment = {
      id: newId('sp'),
      date: dto.date,
      supplierId: dto.supplierId,
      amount: dto.amount,
      purchaseId: null,
      note: dto.note ?? null,
      userId,
      createdAt: new Date(),
    };
    await em.insert(SupplierPayment, payment);
    return payment;
  }

  // ───────────────────────── prixod ─────────────────────────

  purchases(query: DocsQuery) {
    const where: FindOptionsWhere<Purchase> = {
      ...(query.supplierId && { supplierId: query.supplierId }),
      ...(dateRange(query) && { date: dateRange(query) }),
    };
    return this.dataSource.manager.find(Purchase, { where, order: { number: 'DESC' } });
  }

  async purchase(id: string): Promise<Purchase> {
    return (await this.dataSource.manager.findOneBy(Purchase, { id })) ?? fail('not_found', `purchase ${id}`);
  }

  async createPurchase(dto: PurchaseDto, userId: string): Promise<Purchase> {
    checkDate(dto.date);
    const lines = dto.lines.map((line) => ({
      key: line.key as StockKey,
      qty: line.qty,
      unitCost: line.unitCost,
    }));
    return transaction(this.dataSource, (em) =>
      this.insertPurchase(
        em,
        { supplierId: dto.supplierId, date: dto.date, lines, paid: dto.paid, note: dto.note },
        userId,
      ),
    );
  }

  /**
   * Prixod: hujjat + har qator bo'yicha ombor kirimi (o'rtacha tannarx qayta hisoblanadi) + to'lov (bo'lsa).
   * To'lanmagan qismi yetkazib beruvchiga qarz bo'lib qoladi.
   */
  async insertPurchase(
    em: EntityManager,
    input: PurchaseInput,
    userId: string,
    at = new Date(),
  ): Promise<Purchase> {
    await this.checkLines(
      em,
      input.lines.map((line) => line.key),
    );
    if (!(await em.existsBy(Supplier, { id: input.supplierId })))
      fail('not_found', `supplier ${input.supplierId}`);
    const total = input.lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
    if (input.paid > total) fail('overpaid');

    const purchase: Purchase = {
      id: newId('pr'),
      number: await nextCounter(em, 'purchase'),
      date: input.date,
      supplierId: input.supplierId,
      lines: input.lines,
      total,
      note: input.note ?? null,
      userId,
      createdAt: at,
    };
    await em.insert(Purchase, purchase);
    await this.stock.lock(
      em,
      input.lines.map((line) => line.key),
    );
    for (const line of input.lines) {
      await this.stock.stockIn(em, line.key, line.qty, line.unitCost, 'purchase', {
        refId: purchase.id,
        userId,
        at,
      });
    }
    if (input.paid > 0) {
      await em.insert(SupplierPayment, {
        id: newId('sp'),
        date: input.date,
        supplierId: input.supplierId,
        amount: input.paid,
        purchaseId: purchase.id,
        note: null,
        userId,
        createdAt: at,
      });
    }
    return purchase;
  }

  // ───────────────────────── inventarizatsiya ─────────────────────────

  inventories(query: DocsQuery) {
    const range = dateRange(query);
    return this.dataSource.manager.find(InventoryCount, {
      where: range ? { date: range } : {},
      order: { number: 'DESC' },
    });
  }

  async inventory(id: string): Promise<InventoryCount> {
    return (
      (await this.dataSource.manager.findOneBy(InventoryCount, { id })) ??
      fail('not_found', `inventory ${id}`)
    );
  }

  async createInventory(input: InventoryInput, userId: string): Promise<InventoryCount> {
    checkDate(input.date);
    return transaction(this.dataSource, (em) => this.insertInventory(em, input, userId));
  }

  /**
   * Sanoq: har qator uchun tizimdagi qoldiq ("kutilgan") va tannarx shu paytda olinadi, qoldiq sanalgan qiymatga
   * tenglashtiriladi (farq — ombor harakati).
   */
  async insertInventory(
    em: EntityManager,
    input: InventoryInput,
    userId: string,
    at = new Date(),
  ): Promise<InventoryCount> {
    const keys = input.lines.map((line) => line.key);
    await this.checkLines(em, keys);
    await this.stock.lock(em, keys);
    const balances = await this.stock.balances(em, keys);
    const inventory: InventoryCount = {
      id: newId('inv'),
      number: await nextCounter(em, 'inventory'),
      date: input.date,
      lines: input.lines.map((line) => {
        const balance = balances.get(line.key)!;
        return { key: line.key, expected: balance.qty, actual: line.actual, unitCost: balance.avgCost };
      }),
      note: input.note ?? null,
      userId,
      createdAt: at,
    };
    await em.insert(InventoryCount, inventory);
    for (const line of inventory.lines) {
      await this.stock.stockSet(em, line.key, line.actual, { refId: inventory.id, userId, at });
    }
    return inventory;
  }

  // ───────────────────────── spisanie ─────────────────────────

  writeOffs(query: DocsQuery) {
    const range = dateRange(query);
    return this.dataSource.manager.find(WriteOff, {
      where: range ? { date: range } : {},
      order: { number: 'DESC' },
    });
  }

  async writeOff(id: string): Promise<WriteOff> {
    return (
      (await this.dataSource.manager.findOneBy(WriteOff, { id })) ?? fail('not_found', `write-off ${id}`)
    );
  }

  async createWriteOff(input: WriteOffInput, userId: string): Promise<WriteOff> {
    checkDate(input.date);
    return transaction(this.dataSource, (em) => this.insertWriteOff(em, input, userId));
  }

  /** Spisanie o'rtacha tannarxda; qoldiqdan ko'p bo'lsa ham yoziladi (qoldiq manfiy — frontend oldindan so'raydi). */
  async insertWriteOff(
    em: EntityManager,
    input: WriteOffInput,
    userId: string,
    at = new Date(),
  ): Promise<WriteOff> {
    const keys = input.lines.map((line) => line.key);
    await this.checkLines(em, keys);
    await this.stock.lock(em, keys);
    const balances = await this.stock.balances(em, keys);
    const writeOff: WriteOff = {
      id: newId('wo'),
      number: await nextCounter(em, 'writeOff'),
      date: input.date,
      reason: input.reason,
      lines: input.lines.map((line) => ({
        key: line.key,
        qty: line.qty,
        unitCost: balances.get(line.key)!.avgCost,
      })),
      note: input.note ?? null,
      userId,
      createdAt: at,
    };
    await em.insert(WriteOff, writeOff);
    for (const line of writeOff.lines) {
      await this.stock.stockOut(em, line.key, line.qty, 'writeoff', { refId: writeOff.id, userId, at });
    }
    return writeOff;
  }

  /** Qatorlar: bir pozitsiya bir marta, egasi (atir / tara) katalogda bor. */
  private async checkLines(em: EntityManager, keys: StockKey[]): Promise<void> {
    if (keys.length === 0) fail('empty_lines');
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key)) fail('duplicate_line', key);
      seen.add(key);
    }
    const missing = await this.stock.missingOwners(em, keys);
    if (missing.length) fail('unknown_stock_item', missing.join(', '));
  }
}
