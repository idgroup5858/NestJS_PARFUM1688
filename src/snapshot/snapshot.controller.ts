import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { Accord, Banner, Brand, Category, Flakon, Note, Product } from '../catalog/entities';
import { Customer } from '../customers/customer.entity';
import { Counter, COUNTER_START } from '../database/counters';
import { Expense, ExpenseCategory } from '../expenses/expense.entities';
import { Order } from '../orders/order.entity';
import { Review } from '../reviews/review.entity';
import { SettingsService } from '../settings/settings.service';
import { StockBalance, StockMovement } from '../stock/stock.entities';
import { User } from '../users/user.entity';
import {
  InventoryCount,
  Purchase,
  Supplier,
  SupplierPayment,
  WriteOff,
} from '../warehouse/warehouse.entities';

/**
 * Butun baza frontend `Db` ko'rinishida (`src/domain/types.ts`) — frontendni backendga ko'chirish bosqichi uchun:
 * `useDb()` shu javob bilan to'ldiriladi, socket'dan `changed` / `order` kelganda qayta olinadi, o'zgarishlar esa
 * tegishli REST endpointlari orqali. Kassir uchun — kassaga kerakli qismi (tannarx, moliya va ombor hujjatlarisiz).
 */
@Controller('snapshot')
export class SnapshotController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  async snapshot(@CurrentUser() user: AuthUser) {
    const em = this.dataSource.manager;
    const admin = user.role === 'admin';
    const [
      settings,
      users,
      brands,
      categories,
      notes,
      accords,
      products,
      flakons,
      banners,
      balances,
      customers,
      orders,
    ] = await Promise.all([
      this.settings.shop(),
      em.find(User, { order: { name: 'ASC' } }),
      em.find(Brand, { order: { name: 'ASC' } }),
      em.find(Category, { order: { sort: 'ASC' } }),
      em.find(Note),
      em.find(Accord),
      em.find(Product, { order: { createdAt: 'DESC' } }),
      em.find(Flakon, { order: { volumeMl: 'ASC' } }),
      em.find(Banner, { order: { sort: 'ASC' } }),
      em.find(StockBalance),
      em.find(Customer),
      em.find(Order, { order: { createdAt: 'ASC' } }),
    ]);
    const stock = Object.fromEntries(
      balances.map((row) => [row.key, { qty: row.qty, avgCost: admin ? row.avgCost : 0 }]),
    );
    const base = {
      settings,
      users,
      brands,
      categories,
      notes,
      accords,
      products,
      flakons,
      banners,
      stock,
      customers,
      orders: admin
        ? orders
        : orders.map((order) => ({
            ...order,
            lines: order.lines.map(({ unitCost: _cost, flakon, ...line }) => ({
              ...line,
              ...(flakon && {
                flakon: { flakonId: flakon.flakonId, paid: flakon.paid, price: flakon.price },
              }),
            })),
          })),
    };
    if (!admin) return base;

    const [
      movements,
      suppliers,
      purchases,
      supplierPayments,
      inventories,
      writeOffs,
      expenseCategories,
      expenses,
      reviews,
      counters,
    ] = await Promise.all([
      em.find(StockMovement, { order: { at: 'ASC' } }),
      em.find(Supplier, { order: { name: 'ASC' } }),
      em.find(Purchase, { order: { number: 'ASC' } }),
      em.find(SupplierPayment, { order: { createdAt: 'ASC' } }),
      em.find(InventoryCount, { order: { number: 'ASC' } }),
      em.find(WriteOff, { order: { number: 'ASC' } }),
      em.find(ExpenseCategory, { order: { name: 'ASC' } }),
      em.find(Expense, { order: { createdAt: 'ASC' } }),
      em.find(Review, { order: { createdAt: 'ASC' } }),
      em.find(Counter),
    ]);
    const counter = (key: keyof typeof COUNTER_START) =>
      counters.find((row) => row.key === key)?.value ?? COUNTER_START[key];
    return {
      ...base,
      movements,
      suppliers,
      purchases,
      supplierPayments,
      inventories,
      writeOffs,
      expenseCategories,
      expenses,
      reviews,
      counters: {
        order: counter('order'),
        purchase: counter('purchase'),
        inventory: counter('inventory'),
        writeOff: counter('writeOff'),
      },
    };
  }
}
