import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { Setting } from '../database/setting.entity';

export interface ShopSettings {
  name: string;
  phone: string;
  address: string;
  /** mijoz ilovasi rangi (frontend theme/accents.ts) */
  customerAccentId: string;
  /** razliv: eng kam buyurtma, gramm */
  minGrams: number;
  /** hajm tanlash tugmalari, gramm */
  gramChips: number[];
  /** shundan kam qolsa ogohlantirish */
  lowStockGrams: number;
  lowStockPieces: number;
  receiptFooter: string;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  name: 'PARFUM1688',
  phone: '',
  address: '',
  customerAccentId: 'emerald',
  minGrams: 50,
  gramChips: [50, 100, 200, 500],
  lowStockGrams: 300,
  lowStockPieces: 3,
  receiptFooter: '',
};

/** Mijoz ilovasiga ochiq qism (kam qolish chegaralari va chek matnisiz). */
export type PublicShopSettings = Pick<
  ShopSettings,
  'name' | 'phone' | 'address' | 'customerAccentId' | 'minGrams' | 'gramChips'
>;

export function publicShopSettings(settings: ShopSettings): PublicShopSettings {
  const { name, phone, address, customerAccentId, minGrams, gramChips } = settings;
  return { name, phone, address, customerAccentId, minGrams, gramChips };
}

/** `settings` jadvali: kalit → JSON qiymat. */
@Injectable()
export class SettingsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get<T>(key: string, em: EntityManager = this.dataSource.manager): Promise<T | null> {
    const row = await em.findOneBy(Setting, { key });
    return row ? (row.value as T) : null;
  }

  async set(key: string, value: unknown, em: EntityManager = this.dataSource.manager): Promise<void> {
    await em.upsert(Setting, { key, value: value as object }, ['key']);
  }

  /** Do'kon sozlamalari (saqlanmagan maydonlar — standart qiymat bilan). */
  async shop(em: EntityManager = this.dataSource.manager): Promise<ShopSettings> {
    const stored = await this.get<Partial<ShopSettings>>('shop', em);
    return { ...DEFAULT_SHOP_SETTINGS, ...stored };
  }

  async updateShop(patch: Partial<ShopSettings>): Promise<ShopSettings> {
    return this.dataSource.transaction(async (em) => {
      // bir vaqtdagi ikki saqlash bir-birining maydonlarini o'chirmasin
      await em.query(`SELECT 1 FROM settings WHERE key = 'shop' FOR UPDATE`);
      const next = { ...(await this.shop(em)), ...patch };
      await this.set('shop', next, em);
      return next;
    });
  }
}
