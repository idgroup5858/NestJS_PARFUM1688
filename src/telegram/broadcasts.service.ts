import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { fail } from '../common/errors';
import { newId } from '../common/ids';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { subscriberLang } from './telegram-config';
import { TelegramApiError, webAppKeyboard, type TgInlineKeyboard } from './telegram.api';
import { TelegramBroadcast, TelegramSubscriber } from './telegram.entities';
import { TelegramService } from './telegram.service';

export const AUDIENCES = ['all', 'buyers', 'ru', 'uz'] as const;
export type Audience = (typeof AUDIENCES)[number];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Rassilka: faol obunachilarga ketma-ket (~25 ta / soniya — Telegram cheklovi 30), 429 bo'lsa aytilgan vaqt kutiladi.
 * Serverda ishlaydi — admin sahifani yopsa ham davom etadi; jarayon `GET /telegram/broadcasts` da ko'rinadi.
 */
@Injectable()
export class BroadcastsService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Broadcast');
  private readonly stopRequested = new Set<string>();
  private running: string | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly telegram: TelegramService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Server o'chib-yonganda "davom etmoqda" bo'lib qolgan rassilkalar — to'xtatilgan. */
  async onApplicationBootstrap(): Promise<void> {
    await this.dataSource.manager.update(TelegramBroadcast, { status: 'running' }, { status: 'stopped' });
  }

  list() {
    return this.dataSource.manager.find(TelegramBroadcast, { order: { at: 'DESC' }, take: 50 });
  }

  /** Qabul qiluvchilar: faol obunachilar, [audience] bo'yicha. */
  async recipients(audience: Audience): Promise<TelegramSubscriber[]> {
    const active = await this.dataSource.manager.find(TelegramSubscriber, { where: { status: 'active' } });
    if (audience === 'all') return active;
    if (audience === 'ru' || audience === 'uz')
      return active.filter((item) => subscriberLang(item.languageCode) === audience);
    const rows: { telegramId: string }[] = await this.dataSource.query(
      `SELECT DISTINCT c."telegramId" FROM customers c JOIN orders o ON o."customerId" = c.id WHERE c."telegramId" IS NOT NULL`,
    );
    const buyers = new Set(rows.map((row) => Number(row.telegramId)));
    return active.filter((item) => buyers.has(item.id));
  }

  /** Mini App tugmasi (bot sozlamasida https manzil bo'lsa). */
  async keyboard(withButton: boolean, buttonText: string): Promise<TgInlineKeyboard | undefined> {
    if (!withButton) return undefined;
    return webAppKeyboard(buttonText, (await this.telegram.config()).miniAppUrl);
  }

  /** Sinov xabari — xodimlar chatiga (sozlamada ko'rsatilgan). */
  async test(text: string, keyboard: TgInlineKeyboard | undefined) {
    const chat = (await this.telegram.config()).notify.staffChatId.trim();
    if (!chat) fail('no_recipients', 'staffChatId');
    await this.telegram.adminSend(chat, text, keyboard);
  }

  async start(input: { text: string; audience: Audience; keyboard?: TgInlineKeyboard }, userId: string) {
    const config = await this.telegram.config();
    if (!config.token) fail('telegram_not_connected');
    if (this.running) fail('broadcast_running');
    const recipients = await this.recipients(input.audience);
    if (recipients.length === 0) fail('no_recipients');

    const record: TelegramBroadcast = {
      id: newId('bc'),
      at: new Date(),
      text: input.text,
      audience: input.audience,
      total: recipients.length,
      sent: 0,
      failed: 0,
      blocked: 0,
      status: 'running',
      userId,
    };
    await this.dataSource.manager.insert(TelegramBroadcast, record);
    this.running = record.id;
    void this.run(record, recipients, config.token, input.keyboard)
      .catch((error: Error) => this.logger.error(`${record.id}: ${error.message}`))
      .finally(() => {
        this.running = null;
        this.stopRequested.delete(record.id);
      });
    return record;
  }

  async stop(id: string) {
    const record = await this.dataSource.manager.findOneBy(TelegramBroadcast, { id });
    if (!record) fail('not_found', `broadcast ${id}`);
    if (record.status === 'running') this.stopRequested.add(id);
    return record;
  }

  private async run(
    record: TelegramBroadcast,
    recipients: TelegramSubscriber[],
    token: string,
    keyboard?: TgInlineKeyboard,
  ) {
    let savedAt = Date.now();
    const save = async () => {
      savedAt = Date.now();
      const { sent, failed, blocked, status } = record;
      await this.dataSource.manager.update(TelegramBroadcast, record.id, { sent, failed, blocked, status });
      this.realtime.changed('telegram');
    };

    for (const recipient of recipients) {
      if (this.stopRequested.has(record.id)) {
        record.status = 'stopped';
        break;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await this.telegram.sendToChat(recipient.id, record.text, { keyboard, log: false }, token);
          record.sent += 1;
          break;
        } catch (error) {
          if (error instanceof TelegramApiError && error.code === 429 && attempt < 2) {
            await sleep((error.retryAfter ?? 3) * 1000);
            continue;
          }
          if (error instanceof TelegramApiError && error.code === 403) record.blocked += 1;
          else record.failed += 1;
          break;
        }
      }
      if (Date.now() - savedAt > 2_000) await save();
      await sleep(40);
    }
    if (record.status === 'running') record.status = 'done';
    await save();
  }
}
