import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { newId } from '../common/ids';
import { Customer } from './customer.entity';

@Injectable()
export class CustomersService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Har mijoz bilan: buyurtmalar soni, xarid summasi (berilganlar) va oxirgi buyurtma vaqti. */
  async list() {
    const rows: {
      id: string;
      name: string;
      phone: string;
      telegramId: string | null;
      createdAt: Date;
      orders: string;
      spent: string | null;
      lastOrderAt: Date | null;
    }[] = await this.dataSource.query(
      `SELECT c.id, c.name, c.phone, c."telegramId", c."createdAt",
              count(o.id) AS orders,
              sum(CASE WHEN o.status = 'done' THEN
                    o."deliveryFee"
                    + (SELECT COALESCE(sum((l->>'qty')::numeric * (l->>'unitPrice')::numeric
                        + CASE WHEN (l->'flakon'->>'paid')::boolean THEN (l->'flakon'->>'price')::numeric ELSE 0 END), 0)
                       FROM jsonb_array_elements(o.lines) l)
                  END) AS spent,
              max(o."createdAt") AS "lastOrderAt"
       FROM customers c LEFT JOIN orders o ON o."customerId" = c.id
       GROUP BY c.id
       ORDER BY max(o."createdAt") DESC NULLS LAST, c."createdAt" DESC`,
    );
    return rows.map((row) => ({
      ...row,
      telegramId: row.telegramId === null ? null : Number(row.telegramId),
      orders: Number(row.orders),
      spent: Number(row.spent ?? 0),
    }));
  }

  /** Kassa: telefon bo'yicha (ismini avtomatik qo'yish uchun). */
  byPhone(phone: string): Promise<Customer | null> {
    return this.dataSource.manager.findOne(Customer, { where: { phone }, order: { createdAt: 'ASC' } });
  }

  byTelegram(telegramId: number, em: EntityManager = this.dataSource.manager): Promise<Customer | null> {
    return em.findOneBy(Customer, { telegramId });
  }

  /**
   * Kassa sotuvi: raqam egasi topiladi, bo'lmasa yaratiladi. Bazadagi mijozning ismi kassada qayta yozilmaydi (kassir
   * taxallus yozgan bo'lishi mumkin) — faqat bo'sh bo'lsa to'ldiriladi. Raqamsiz sotuv — mijozsiz.
   */
  async forPosSale(em: EntityManager, contact: { name: string; phone: string }): Promise<Customer | null> {
    if (!contact.phone) return null;
    const existing = await em.findOne(Customer, {
      where: { phone: contact.phone },
      order: { createdAt: 'ASC' },
    });
    if (existing) {
      if (!existing.name && contact.name) {
        existing.name = contact.name;
        await em.update(Customer, existing.id, { name: contact.name });
      }
      return existing;
    }
    const customer: Customer = {
      id: newId('c'),
      name: contact.name,
      phone: contact.phone,
      telegramId: null,
      createdAt: new Date(),
    };
    await em.insert(Customer, customer);
    return customer;
  }

  /**
   * Mijoz ilovasidan buyurtma qaysi mijozga yoziladi (frontend `CheckoutPage.linkCustomer`). Qurilma — bitta mijoz;
   * boshqa raqam yozilsa (qarindoshi uchun buyurtma) qurilma o'sha raqam egasiga "ko'chib" qolmaydi. Kim uchunligi
   * (ism, raqam) buyurtmaning o'zida saqlanadi.
   *   1) Telegram id bo'yicha — Telegram tasdiqlagan shaxs (boshqa qurilmasidan ham).
   *   2) Qurilmaning o'z mijozi (birinchi buyurtmada yaratilgan) — boshqa Telegram akkauntniki bo'lmasa.
   *   3) Telefon bo'yicha — faqat hech kimga bog'lanmagan yozuv: Telegram id si yo'q va botdan buyurtma bermagan
   *      (masalan, kassada telefonini aytib xarid qilgan mijoz).
   *   4) Aks holda — yangi mijoz.
   * Mavjud mijozning ismi va raqami ustidan yozilmaydi — faqat bo'sh bo'lsa to'ldiriladi.
   */
  async forShopOrder(
    em: EntityManager,
    device: { customerId: string | null; telegramId: number | null },
    contact: { name: string; phone: string },
  ): Promise<Customer> {
    const { telegramId } = device;
    const byTelegram = telegramId !== null ? await this.byTelegram(telegramId, em) : null;
    let own: Customer | null = null;
    if (!byTelegram && device.customerId) {
      const found = await em.findOneBy(Customer, { id: device.customerId });
      if (found && (telegramId === null || found.telegramId === null || found.telegramId === telegramId))
        own = found;
    }
    let byPhone: Customer | null = null;
    if (!byTelegram && !own) {
      const rows: { id: string }[] = await em.query(
        `SELECT c.id FROM customers c
         WHERE c.phone = $1 AND c."telegramId" IS NULL
           AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.source = 'bot' AND o."customerId" = c.id)
         ORDER BY c."createdAt" LIMIT 1`,
        [contact.phone],
      );
      if (rows[0]) byPhone = await em.findOneBy(Customer, { id: rows[0].id });
    }

    const existing = byTelegram ?? own ?? byPhone;
    if (existing) {
      const patch: Partial<Customer> = {};
      if (!existing.name) patch.name = contact.name;
      if (!existing.phone) patch.phone = contact.phone;
      // byTelegram bo'lmagani uchun bu Telegram id boshqa hech kimda yo'q
      if (telegramId !== null && existing.telegramId === null) patch.telegramId = telegramId;
      if (Object.keys(patch).length) {
        await em.update(Customer, existing.id, patch);
        Object.assign(existing, patch);
      }
      return existing;
    }
    const customer: Customer = {
      id: newId('c'),
      name: contact.name,
      phone: contact.phone,
      telegramId,
      createdAt: new Date(),
    };
    await em.insert(Customer, customer);
    return customer;
  }
}
