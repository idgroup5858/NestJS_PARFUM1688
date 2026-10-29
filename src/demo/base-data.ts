import { EntityManager } from 'typeorm';
import { Accord, Banner, Brand, Category, Flakon, Note, Product } from '../catalog/entities';
import type { Role } from '../common/types';
import { Counter, COUNTER_START } from '../database/counters';
import { ExpenseCategory } from '../expenses/expense.entities';
import { SettingsService, type ShopSettings } from '../settings/settings.service';
import { User } from '../users/user.entity';
import { Supplier } from '../warehouse/warehouse.entities';
import accords from './data/accords.json';
import banners from './data/banners.json';
import brands from './data/brands.json';
import categories from './data/categories.json';
import expenseCategories from './data/expenseCategories.json';
import flakons from './data/flakons.json';
import notes from './data/notes.json';
import products from './data/products.json';
import settings from './data/settings.json';
import suppliers from './data/suppliers.json';
import users from './data/users.json';

/** Frontend seed JSON lari (`ReactJS_PARFUM1688/src/data/seed`) — shu tartibda (demo tarix tasodifiyligi tartibga bog'liq). */
export const SEED = {
  accords: accords as Accord[],
  banners: banners as Banner[],
  brands: brands as { id: string; name: string; country?: string }[],
  categories: categories as Category[],
  expenseCategories: expenseCategories as ExpenseCategory[],
  flakons: flakons as Flakon[],
  notes: notes as Note[],
  products: products as unknown as Omit<Product, 'createdAt'>[],
  settings: settings as ShopSettings,
  suppliers: suppliers as { id: string; name: string; phone: string; note?: string }[],
  users: users as { id: string; name: string; role: Role; pin: string; active: boolean }[],
};

/**
 * Boshlang'ich ma'lumot: do'kon sozlamalari, xodimlar (demo PIN'lar bilan), katalog, yetkazib beruvchilar, chiqim
 * kategoriyalari. [startedAt] — atir va yetkazib beruvchilar "yaratilgan" vaqt (demo tarixdan oldin).
 */
export async function insertBaseData(
  em: EntityManager,
  settingsService: SettingsService,
  pinDigest: (pin: string) => string,
  startedAt: Date,
): Promise<void> {
  await settingsService.set('shop', SEED.settings, em);
  await em.insert(
    User,
    SEED.users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      pinDigest: pinDigest(user.pin),
      active: user.active,
      createdAt: startedAt,
    })),
  );
  await em.insert(
    Brand,
    SEED.brands.map((brand) => ({ id: brand.id, name: brand.name, country: brand.country ?? null })),
  );
  await em.insert(Category, SEED.categories);
  await em.insert(Note, SEED.notes);
  await em.insert(Accord, SEED.accords);
  await em.insert(
    Product,
    SEED.products.map((product) => ({ ...product, createdAt: startedAt })),
  );
  await em.insert(Flakon, SEED.flakons);
  await em.insert(Banner, SEED.banners);
  await em.insert(
    Supplier,
    SEED.suppliers.map((supplier) => ({ ...supplier, note: supplier.note ?? null, createdAt: startedAt })),
  );
  await em.insert(ExpenseCategory, SEED.expenseCategories);
  await em.insert(
    Counter,
    Object.entries(COUNTER_START).map(([key, value]) => ({ key, value })),
  );
}
