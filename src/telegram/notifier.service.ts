import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrderStatus } from '../common/types';
import { Customer } from '../customers/customer.entity';
import type { Order } from '../orders/order.entity';
import { SettingsService } from '../settings/settings.service';
import { CUSTOMER_NOTIFY_STATUSES, customerStatusMessage, staffNewOrderMessage } from './messages';
import { subscriberLang } from './telegram-config';
import { TelegramSubscriber } from './telegram.entities';
import { TelegramService } from './telegram.service';

/**
 * Buyurtma xabarnomalari (tranzaksiyadan keyin, javobni kutmasdan): yangi bot buyurtmasi → xodimlar chatiga, holat
 * o'zgarishi → mijozga (Telegram'i bo'lsa, botni bloklamagan bo'lsa). Navbat bilan — bir buyurtmaning "Qabul qilindi"
 * va "Tayyor" xabarlari aralashib ketmasin.
 */
@Injectable()
export class TelegramNotifier {
  private readonly logger = new Logger('TelegramNotifier');
  private queue: Promise<void> = Promise.resolve();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly telegram: TelegramService,
    private readonly settings: SettingsService,
  ) {}

  /** [previous] = `null` — buyurtma hozir yaratildi. */
  orderChanged(order: Order, previous: OrderStatus | null): void {
    if (process.env.TELEGRAM === 'off' || order.source !== 'bot') return;
    this.queue = this.queue
      .then(() => this.notify(order, previous))
      .catch((error: Error) => this.logger.warn(`#${order.number}: ${error.message}`));
  }

  private async notify(order: Order, previous: OrderStatus | null): Promise<void> {
    const config = await this.telegram.config();
    if (!config.token) return;

    const staffChat = config.notify.staff ? config.notify.staffChatId.trim() : '';
    if (previous === null && staffChat && order.status !== 'cancelled') {
      await this.telegram
        .sendToChat(
          staffChat,
          staffNewOrderMessage(order, config.notify.staffLang),
          {
            name: config.notify.staffLang === 'uz' ? 'Xodimlar chati' : 'Чат сотрудников',
          },
          config.token,
        )
        .catch((error: unknown) => this.telegram.reportSendError(error));
    }

    if (
      previous === order.status ||
      !config.notify.customers ||
      !CUSTOMER_NOTIFY_STATUSES.includes(order.status)
    )
      return;
    if (!order.customerId) return;
    const customer = await this.dataSource.manager.findOneBy(Customer, { id: order.customerId });
    if (!customer?.telegramId) return;
    const subscriber = await this.dataSource.manager.findOneBy(TelegramSubscriber, {
      id: customer.telegramId,
    });
    if (subscriber?.status === 'blocked') return;
    const text = customerStatusMessage(
      await this.settings.shop(),
      order,
      subscriberLang(subscriber?.languageCode),
    );
    if (!text) return;
    await this.telegram
      .sendToChat(customer.telegramId, text, { name: customer.name }, config.token)
      .catch((error: unknown) => this.telegram.reportSendError(error));
  }
}
