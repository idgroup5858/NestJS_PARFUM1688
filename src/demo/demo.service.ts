import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { transaction } from '../database/transaction';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { StockService } from '../stock/stock.service';
import { User } from '../users/user.entity';
import { WarehouseService } from '../warehouse/warehouse.service';
import { insertBaseData, SEED } from './base-data';
import { generateHistory } from './demo-history';

/** Tozalanadigan jadvallar (Telegram obunachilari va xabarlari, kalitlar va bot sozlamalari — qoladi). */
const TABLES = [
  'reviews',
  'orders',
  'customers',
  'stock_movements',
  'stock',
  'supplier_payments',
  'purchases',
  'inventories',
  'write_offs',
  'expenses',
  'expense_categories',
  'suppliers',
  'products',
  'brands',
  'categories',
  'notes',
  'accords',
  'flakons',
  'banners',
  'users',
  'counters',
  'telegram_broadcasts',
];

/** Faqat aniq `DEMO=1` — berilmagan bo'lsa (haqiqiy server) "tiklash" bazani o'chirib yubormasin. */
export const demoEnabled = () => process.env.DEMO === '1';

@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Demo');

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
    private readonly stock: StockService,
    private readonly orders: OrdersService,
    private readonly warehouse: WarehouseService,
  ) {}

  /**
   * Bo'sh baza (birinchi ishga tushish): katalog va xodimlar yoziladi; `DEMO=1` bo'lsa — 30 kunlik demo savdo tarixi
   * ham. Seed buyrug'i (`SEED_ON_START=off`) o'zi yozadi.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SEED_ON_START === 'off') return;
    if ((await this.dataSource.manager.count(User)) > 0) return;
    const history = demoEnabled();
    const started = Date.now();
    await this.reset({ history });
    this.logger.log(
      `Bo'sh bazaga ${history ? "demo ma'lumot" : 'katalog va xodimlar'} yozildi (${Date.now() - started} ms)`,
    );
    this.logger.warn(
      "Demo PIN'lar: 1111 (admin), 2222, 3333 (kassir) — haqiqiy ishda Admin → Xodimlar'da almashtiring",
    );
  }

  /** Bazani tozalab boshlang'ich ma'lumot (va [history] — demo tarix) yozadi. Hammasi bitta tranzaksiyada. */
  async reset(options: { history: boolean }): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await em.query(`TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`);
      const startedAt = new Date(Date.now() - 60 * 86_400_000);
      await insertBaseData(em, this.settings, (pin) => this.auth.pinDigest(pin), startedAt);
      if (options.history) {
        await generateHistory(em, { stock: this.stock, orders: this.orders, warehouse: this.warehouse });
      }
    });
  }

  /**
   * Kirish sahifasidagi "Demo PIN kodlar" (faqat `DEMO=1`): seed xodimlaridan PIN'i hali o'zgarmagan va faol bo'lganlari.
   * PIN'ning o'zi bazada yo'q — seed JSON dagi PIN xeshi bazadagiga mos kelsagina ko'rsatiladi.
   */
  async pins(): Promise<{ name: string; role: User['role']; pin: string }[]> {
    if (!demoEnabled()) return [];
    const result: { name: string; role: User['role']; pin: string }[] = [];
    for (const seed of SEED.users) {
      const user = await this.dataSource.manager.findOneBy(User, {
        pinDigest: this.auth.pinDigest(seed.pin),
        active: true,
      });
      if (user) result.push({ name: user.name, role: user.role, pin: seed.pin });
    }
    return result;
  }

  /** Jadvallardagi yozuvlar soni (seed hisoboti). */
  async counts(): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    for (const table of [...TABLES].reverse()) {
      const rows: { count: string }[] = await this.dataSource.query(`SELECT count(*) FROM "${table}"`);
      result[table] = Number(rows[0].count);
    }
    return result;
  }
}
