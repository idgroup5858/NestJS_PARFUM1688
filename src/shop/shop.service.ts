import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import type { CustomerSession } from '../auth/auth.types';
import { Accord, Banner, Brand, Category, Flakon, Note, Product } from '../catalog/entities';
import { fail } from '../common/errors';
import { isUzPhone } from '../common/format';
import { Customer } from '../customers/customer.entity';
import { CustomersService } from '../customers/customers.service';
import { Order } from '../orders/order.entity';
import { customerOrderView } from '../orders/order.views';
import { OrdersService } from '../orders/orders.service';
import { ReviewsService } from '../reviews/reviews.service';
import { publicShopSettings, SettingsService } from '../settings/settings.service';
import { stockKey } from '../stock/stock-key';
import { StockService } from '../stock/stock.service';
import { verifyInitData } from '../telegram/init-data';
import { TelegramService } from '../telegram/telegram.service';
import { ShopOrderDto } from './shop.dto';
import { slotAvailable } from './slots';

const customerView = (customer: Customer) => ({
  id: customer.id,
  name: customer.name,
  phone: customer.phone,
});

/**
 * Mijoz ilovasi (Telegram Mini App yoki oddiy brauzer) uchun ochiq API: katalog, buyurtma berish, "Мои заказы",
 * sharhlar. Mijoz kimligi — qurilma tokeni (birinchi buyurtmada yoki Telegram `initData` bilan beriladi).
 */
@Injectable()
export class ShopService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
    private readonly stock: StockService,
    private readonly orders: OrdersService,
    private readonly customers: CustomersService,
    private readonly reviews: ReviewsService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Katalog: faol atirlar (mavjudligi — `available`: razliv grammi va original donasi; reyting; `sales30d` — oxirgi 30
   * kunda berilgan buyurtmalardagi qatorlar soni, "Хиты продаж" uchun), faol bannerlar, taralar (buyurtma sahifasida
   * hajmi). Tannarx va kam qolish chegaralari berilmaydi.
   */
  async catalog() {
    const em = this.dataSource.manager;
    const [settings, brands, categories, notes, accords, products, flakons, banners] = await Promise.all([
      this.settings.shop(),
      em.find(Brand, { order: { name: 'ASC' } }),
      em.find(Category, { order: { sort: 'ASC', id: 'ASC' } }),
      em.find(Note),
      em.find(Accord),
      em.find(Product, { where: { active: true }, order: { createdAt: 'DESC', name: 'ASC' } }),
      em.find(Flakon, { order: { volumeMl: 'ASC' } }),
      em.find(Banner, { where: { active: true }, order: { sort: 'ASC', id: 'ASC' } }),
    ]);
    const balances = await this.stock.balances(
      em,
      products.flatMap((product) => [stockKey('gram', product.id), stockKey('bottle', product.id)]),
    );
    const ratings: { productId: string; average: string; count: string }[] = await em.query(
      `SELECT "productId", avg(rating) AS average, count(*) AS count FROM reviews WHERE NOT hidden GROUP BY "productId"`,
    );
    const sales: { productId: string; count: string }[] = await em.query(
      `SELECT l->>'productId' AS "productId", count(*) AS count
       FROM orders o CROSS JOIN jsonb_array_elements(o.lines) l
       WHERE o.status = 'done' AND o."createdAt" >= now() - interval '30 days'
       GROUP BY 1`,
    );
    const ratingOf = new Map(ratings.map((row) => [row.productId, row]));
    const salesOf = new Map(sales.map((row) => [row.productId, Number(row.count)]));
    return {
      settings: publicShopSettings(settings),
      brands,
      categories,
      notes,
      accords,
      flakons,
      products: products.map((product) => {
        const rating = ratingOf.get(product.id);
        return {
          ...product,
          sales30d: salesOf.get(product.id) ?? 0,
          available: {
            grams: Math.max(0, balances.get(stockKey('gram', product.id))!.qty),
            bottles: product.bottle ? Math.max(0, balances.get(stockKey('bottle', product.id))!.qty) : 0,
          },
          rating: {
            average: rating ? Math.round(Number(rating.average) * 10) / 10 : 0,
            count: Number(rating?.count ?? 0),
          },
        };
      }),
      banners,
    };
  }

  /** Telegram'dan ochilgan ilova: `initData` tekshiriladi → qurilma tokeni (shu Telegram akkauntning mijozi bilan). */
  async session(initData: string) {
    const { token: botToken } = await this.telegram.config();
    if (!botToken) fail('telegram_not_connected');
    const user = verifyInitData(initData, botToken) ?? fail('invalid_init_data');
    const customer = await this.customers.byTelegram(user.id);
    const token = await this.auth.signCustomer({ customerId: customer?.id ?? null, telegramId: user.id });
    return {
      token,
      telegramUser: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name ?? null,
        username: user.username ?? null,
        languageCode: user.language_code ?? null,
      },
      customer: customer ? customerView(customer) : null,
    };
  }

  /** Qurilma mijozi: tokendagi id, bo'lmasa — Telegram id bo'yicha (boshqa qurilmada buyurtma bergan bo'lsa). */
  async customerId(session: CustomerSession | null): Promise<string | null> {
    if (!session) return null;
    if (session.customerId) return session.customerId;
    if (session.telegramId !== null) return (await this.customers.byTelegram(session.telegramId))?.id ?? null;
    return null;
  }

  async me(session: CustomerSession) {
    const id = await this.customerId(session);
    const customer = id ? await this.dataSource.manager.findOneBy(Customer, { id }) : null;
    return { customer: customer ? customerView(customer) : null, telegramId: session.telegramId };
  }

  /** Buyurtma berish → buyurtma va yangilangan qurilma tokeni (endi mijoz id si bilan). */
  async placeOrder(dto: ShopOrderDto, session: CustomerSession | null) {
    if (!dto.name) fail('name_required');
    if (!isUzPhone(dto.phone)) fail('phone_invalid', dto.phone);
    if (dto.fulfillment === 'delivery' && (dto.address ?? '').length < 5) fail('address_required');
    // ekrandagi soatlar eskirgan bo'lishi mumkin — tasdiqlash paytidagi vaqt bilan tekshiriladi
    if (!slotAvailable(dto.slot.date, dto.slot.hour))
      fail('invalid_slot', `${dto.slot.date} ${dto.slot.hour}:00`);
    const { minGrams } = await this.settings.shop();
    const small = dto.lines.find((line) => line.kind === 'gram' && line.qty < minGrams);
    if (small) fail('invalid_qty', `${small.productId}: kamida ${minGrams} g`);

    const device = { customerId: session?.customerId ?? null, telegramId: session?.telegramId ?? null };
    const { order, customer } = await this.orders.createShopOrder(
      {
        name: dto.name,
        phone: dto.phone,
        fulfillment: dto.fulfillment,
        address: dto.address,
        slot: { date: dto.slot.date, hour: dto.slot.hour },
        comment: dto.comment,
        lines: dto.lines,
      },
      device,
    );
    const token = await this.auth.signCustomer({ customerId: customer.id, telegramId: device.telegramId });
    return { order: customerOrderView(order), token, customer: customerView(customer) };
  }

  /** "Мои заказы" — eng yangisi birinchi. */
  async myOrders(session: CustomerSession) {
    const customerId = await this.customerId(session);
    if (!customerId) return [];
    const orders = await this.dataSource.manager.find(Order, {
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return orders.map(customerOrderView);
  }

  async myOrder(session: CustomerSession, id: string) {
    const customerId = await this.customerId(session);
    const order = await this.dataSource.manager.findOneBy(Order, { id });
    // boshqa mijozning buyurtmasi — "topilmadi" (borligi bilinmasin)
    if (!order || !customerId || order.customerId !== customerId) fail('not_found', `order ${id}`);
    return customerOrderView(order);
  }

  async productReviews(productId: string, session: CustomerSession | null) {
    const reviews = await this.reviews.visible(productId);
    const customerId = await this.customerId(session);
    const { bought, reviewed } = await this.reviews.eligibility(customerId, productId);
    const average = reviews.length
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    return {
      reviews,
      average: Math.round(average * 10) / 10,
      count: reviews.length,
      canReview: bought && !reviewed,
      reviewed,
    };
  }

  async writeReview(productId: string, session: CustomerSession, rating: number, text: string) {
    const customerId = (await this.customerId(session)) ?? fail('review_not_allowed');
    if (!text) fail('invalid_input', 'text');
    const review = await this.reviews.create(customerId, productId, rating, text);
    const { customerId: _customerId, hidden: _hidden, ...view } = review;
    return view;
  }
}
