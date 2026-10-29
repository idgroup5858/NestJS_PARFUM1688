import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { appError, fail } from '../common/errors';
import { newId } from '../common/ids';
import { transaction } from '../database/transaction';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SettingsService } from '../settings/settings.service';
import { configView, subscriberLang, withDefaults, type TelegramConfig } from './telegram-config';
import {
  callBot,
  describeTelegramError,
  sendMessage,
  TelegramApiError,
  TOKEN_PATTERN,
  webAppKeyboard,
  type TgBotCommand,
  type TgBotInfo,
  type TgInlineKeyboard,
  type TgMenuButton,
  type TgUpdate,
  type TgUser,
  type TgWebhookInfo,
} from './telegram.api';
import { TelegramBroadcast, TelegramMessage, TelegramSubscriber } from './telegram.entities';

const CONFIG_KEY = 'telegram';
const POLL_TIMEOUT_S = 25;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });

const fullName = (user: Pick<TgUser, 'first_name' | 'last_name'>) =>
  [user.first_name, user.last_name].filter(Boolean).join(' ');

export interface SendOptions {
  keyboard?: TgInlineKeyboard;
  /** "Xabarlar" ro'yxatidagi nom (kimga) */
  name?: string;
  /** "Xabarlar" ro'yxatiga yozilsinmi (rassilkada — yo'q) */
  log?: boolean;
}

/**
 * Telegram bot serverda (frontend `integrations/telegram/service.ts` o'rnida — brauzer tabi ochiq turishi shart emas):
 *  - admin tokenni kiritadi, server yangilanishlarni long polling bilan oladi: /start va xabarlar → obunachilar va
 *    "Xabarlar", /start ga salomlashuv (Mini App tugmasi bilan);
 *  - buyurtma xabarnomalari — `TelegramNotifier`, rassilka — `BroadcastsService`.
 * `TELEGRAM=off` — polling o'chiq (testlar).
 */
@Injectable()
export class TelegramService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Telegram');
  private polling: { token: string; abort: AbortController; done: Promise<void> } | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.syncPolling();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.stopPolling();
  }

  // ───────────────────────── sozlamalar ─────────────────────────

  async config(em: EntityManager = this.dataSource.manager): Promise<TelegramConfig> {
    return withDefaults(await this.settings.get<Partial<TelegramConfig>>(CONFIG_KEY, em));
  }

  /** Sozlamani o'zgartiradi (qator qulflanadi — polling va admin bir-birining maydonini o'chirmaydi). */
  async patchConfig(
    patch: Partial<TelegramConfig> | ((current: TelegramConfig) => Partial<TelegramConfig>),
  ): Promise<TelegramConfig> {
    return transaction(this.dataSource, async (em) => {
      await em.query(`SELECT 1 FROM settings WHERE key = $1 FOR UPDATE`, [CONFIG_KEY]);
      const current = await this.config(em);
      const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
      await this.settings.set(CONFIG_KEY, next, em);
      return next;
    });
  }

  async status() {
    return { ...configView(await this.config()), running: this.polling !== null };
  }

  /** Token tekshiriladi (`getMe`, `getWebhookInfo`) va saqlanadi. Boshqa bot bo'lsa — eski obunachilar va tarix o'chadi. */
  async connect(token: string) {
    const clean = token.trim();
    if (!TOKEN_PATTERN.test(clean)) fail('telegram_token_invalid');
    let bot: TgBotInfo;
    let webhook: TgWebhookInfo;
    try {
      [bot, webhook] = await Promise.all([
        callBot<TgBotInfo>(clean, 'getMe'),
        callBot<TgWebhookInfo>(clean, 'getWebhookInfo'),
      ]);
    } catch (error) {
      if (error instanceof TelegramApiError && error.code >= 400 && error.code < 500)
        fail('telegram_token_invalid');
      fail('telegram_unreachable', (error as Error).message);
    }
    await this.stopPolling();
    const previous = await this.config();
    await transaction(this.dataSource, async (em) => {
      if (previous.bot?.id !== bot.id) {
        // boshqa bot — oldingi botning obunachilari va tarixi aralashmasin
        await em.createQueryBuilder().delete().from(TelegramMessage).execute();
        await em.createQueryBuilder().delete().from(TelegramBroadcast).execute();
        await em.createQueryBuilder().delete().from(TelegramSubscriber).execute();
      }
      await this.settings.set(
        CONFIG_KEY,
        {
          ...previous,
          token: clean,
          bot,
          connectedAt: new Date().toISOString(),
          webhookUrl: webhook.url || null,
          polling: !webhook.url,
          lastError: null,
          ...(previous.bot?.id !== bot.id && { offset: 0 }),
        },
        em,
      );
    });
    await this.syncPolling();
    this.realtime.changed('telegram');
    return this.status();
  }

  async refresh() {
    const { token } = await this.requireToken();
    const [bot, webhook] = await this.adminCall(() =>
      Promise.all([callBot<TgBotInfo>(token, 'getMe'), callBot<TgWebhookInfo>(token, 'getWebhookInfo')]),
    );
    await this.patchConfig({
      bot,
      webhookUrl: webhook.url || null,
      lastError: webhook.last_error_message ? `Webhook xatosi: ${webhook.last_error_message}` : null,
    });
    await this.syncPolling();
    return this.status();
  }

  /** Token o'chiriladi: yangilanishlar va xabarnomalar to'xtaydi. Obunachilar ro'yxati saqlanib qoladi. */
  async disconnect() {
    await this.stopPolling();
    await this.patchConfig({ token: '', lastError: null });
    this.realtime.changed('telegram');
    return this.status();
  }

  /** Webhook o'chiriladi — yangilanishlarni shu server qabul qiladi. */
  async deleteWebhook() {
    const { token } = await this.requireToken();
    await this.adminCall(() => callBot(token, 'deleteWebhook', { drop_pending_updates: false }));
    await this.patchConfig({ webhookUrl: null, polling: true, lastError: null });
    await this.syncPolling();
    return this.status();
  }

  async updateSettings(
    patch: Partial<Pick<TelegramConfig, 'miniAppUrl' | 'menuButtonText' | 'polling'>> & {
      clearError?: boolean;
      welcome?: Partial<TelegramConfig['welcome']>;
      notify?: Partial<TelegramConfig['notify']>;
    },
  ) {
    await this.patchConfig((current) => ({
      ...(patch.miniAppUrl !== undefined && { miniAppUrl: patch.miniAppUrl }),
      ...(patch.menuButtonText !== undefined && { menuButtonText: patch.menuButtonText }),
      ...(patch.polling !== undefined && { polling: patch.polling }),
      ...(patch.clearError && { lastError: null }),
      ...(patch.welcome && { welcome: { ...current.welcome, ...patch.welcome } }),
      ...(patch.notify && { notify: { ...current.notify, ...patch.notify } }),
    }));
    await this.syncPolling();
    this.realtime.changed('telegram');
    return this.status();
  }

  // ───────────────────────── bot profili (BotFather o'rniga) ─────────────────────────

  async profile() {
    const { token } = await this.requireToken();
    const [commands, description, shortDescription, menuButton] = await this.adminCall(() =>
      Promise.all([
        callBot<TgBotCommand[]>(token, 'getMyCommands'),
        callBot<{ description: string }>(token, 'getMyDescription'),
        callBot<{ short_description: string }>(token, 'getMyShortDescription'),
        callBot<TgMenuButton>(token, 'getChatMenuButton'),
      ]),
    );
    return {
      commands,
      description: description.description,
      shortDescription: shortDescription.short_description,
      menuButton,
    };
  }

  async setCommands(commands: TgBotCommand[]) {
    const { token } = await this.requireToken();
    await this.adminCall(() => callBot(token, 'setMyCommands', { commands }));
  }

  async setDescription(description: string, shortDescription: string) {
    const { token } = await this.requireToken();
    await this.adminCall(() =>
      Promise.all([
        callBot(token, 'setMyDescription', { description }),
        callBot(token, 'setMyShortDescription', { short_description: shortDescription }),
      ]),
    );
  }

  async setMenuButton(menuButton: TgMenuButton) {
    const { token } = await this.requireToken();
    await this.adminCall(() => callBot(token, 'setChatMenuButton', { menu_button: menuButton }));
  }

  // ───────────────────────── obunachilar va xabarlar ─────────────────────────

  /** Obunachilar (oxirgi faolligi bo'yicha) — bog'langan mijoz va uning buyurtmalari soni bilan. */
  async subscribers() {
    const rows: (Omit<TelegramSubscriber, 'id'> & {
      id: string;
      customerId: string | null;
      orders: string;
    })[] = await this.dataSource.query(
      `SELECT s.*, c.id AS "customerId",
                (SELECT count(*) FROM orders o WHERE c.id IS NOT NULL AND o."customerId" = c.id) AS orders
         FROM telegram_subscribers s LEFT JOIN customers c ON c."telegramId" = s.id
         ORDER BY s."lastSeen" DESC`,
    );
    return rows.map((row) => ({ ...row, id: Number(row.id), orders: Number(row.orders) }));
  }

  messages(chatId: number | undefined, limit: number) {
    return this.dataSource.manager.find(TelegramMessage, {
      where: chatId !== undefined ? { chatId } : {},
      order: { at: 'DESC' },
      take: limit,
    });
  }

  /** Admin bitta chatga yozadi (javob xatosi — admin ko'radi). */
  async adminSend(chatId: number | string, text: string, keyboard?: TgInlineKeyboard) {
    const subscriber = /^\d+$/.test(String(chatId))
      ? await this.dataSource.manager.findOneBy(TelegramSubscriber, { id: Number(chatId) })
      : null;
    await this.adminCall(() =>
      this.sendToChat(chatId, text, {
        keyboard,
        name: subscriber
          ? [subscriber.firstName, subscriber.lastName].filter(Boolean).join(' ')
          : String(chatId),
      }),
    );
  }

  /**
   * Bitta chatga xabar. Foydalanuvchi botni bloklagan bo'lsa (403) — obunachi "bloklagan" deb belgilanadi va xato
   * qaytadi (chaqiruvchi hal qiladi).
   */
  async sendToChat(
    chatId: number | string,
    text: string,
    options: SendOptions = {},
    token?: string,
  ): Promise<void> {
    const botToken = token ?? (await this.config()).token;
    if (!botToken) throw appError('telegram_not_connected');
    try {
      await sendMessage(botToken, chatId, text, options.keyboard);
    } catch (error) {
      if (error instanceof TelegramApiError && error.code === 403 && /^\d+$/.test(String(chatId))) {
        await this.dataSource.manager.update(
          TelegramSubscriber,
          { id: Number(chatId) },
          { status: 'blocked' },
        );
      }
      throw error;
    }
    if (options.log !== false) {
      await this.dataSource.manager.insert(TelegramMessage, {
        id: newId('tgm'),
        chatId: Number(chatId),
        direction: 'out',
        name: (options.name ?? String(chatId)).slice(0, 150),
        text,
        at: new Date(),
      });
    }
  }

  /** Avtomatik xabar yuborilmadi — sababi integratsiya sahifasida ("chat topilmadi" — demo mijozlar, jim). */
  async reportSendError(error: unknown): Promise<void> {
    if (error instanceof TelegramApiError && error.code === 400 && /chat not found/i.test(error.message))
      return;
    if (error instanceof TelegramApiError && error.code === 403) return;
    this.logger.warn(`Xabar yuborilmadi: ${describeTelegramError(error)}`);
    await this.patchConfig({ lastError: `Xabar yuborilmadi: ${describeTelegramError(error)}` }).catch(
      () => undefined,
    );
  }

  // ───────────────────────── yangilanishlar (long polling) ─────────────────────────

  /** Token, `polling` va webhook holatiga qarab pollingni yoqadi / o'chiradi. */
  private async syncPolling(): Promise<void> {
    const config = await this.config();
    const should = process.env.TELEGRAM !== 'off' && !!config.token && config.polling && !config.webhookUrl;
    if (should && this.polling?.token === config.token) return;
    await this.stopPolling();
    if (should) this.startPolling(config.token);
  }

  private startPolling(token: string): void {
    const abort = new AbortController();
    const polling = { token, abort, done: Promise.resolve() };
    polling.done = this.poll(token, abort.signal)
      .catch((error: Error) => this.logger.error(`Polling to'xtadi: ${error.message}`))
      .finally(() => {
        if (this.polling === polling) this.polling = null;
      });
    this.polling = polling;
  }

  private async stopPolling(): Promise<void> {
    const polling = this.polling;
    this.polling = null;
    if (!polling) return;
    polling.abort.abort();
    await polling.done;
  }

  private async poll(token: string, signal: AbortSignal): Promise<void> {
    this.logger.log('Bot ishga tushdi (long polling)');
    while (!signal.aborted) {
      const config = await this.config();
      if (config.token !== token || !config.polling) break;
      try {
        const updates = await callBot<TgUpdate[]>(
          token,
          'getUpdates',
          { offset: config.offset, timeout: POLL_TIMEOUT_S, allowed_updates: ['message', 'my_chat_member'] },
          { signal, timeoutMs: (POLL_TIMEOUT_S + 10) * 1000 },
        );
        if (signal.aborted) break;
        await this.handleUpdates(token, updates);
      } catch (error) {
        if (signal.aborted) break;
        const fatal =
          error instanceof TelegramApiError &&
          (error.code === 401 ||
            error.code === 404 ||
            (error.code === 409 && /webhook/i.test(error.message)));
        if (fatal) {
          this.logger.error(`Bot to'xtadi: ${describeTelegramError(error)}`);
          await this.patchConfig({ polling: false, lastError: describeTelegramError(error) });
          this.realtime.changed('telegram');
          break;
        }
        if (error instanceof TelegramApiError && error.code === 409) {
          // boshqa joyda (eski server / brauzer tabi) hali so'rov tugamagan — biroz kutib qayta
          this.logger.warn('Shu bot boshqa joyda ham yangilanish olmoqda (409) — kutilmoqda');
          await sleep(3_000, signal);
          continue;
        }
        await this.patchConfig({ lastError: describeTelegramError(error) }).catch(() => undefined);
        const retry = error instanceof TelegramApiError && error.retryAfter ? error.retryAfter * 1000 : 5_000;
        await sleep(retry, signal);
      }
    }
  }

  /** Obunachilar, "Xabarlar" va offset — bitta tranzaksiyada; /start javoblari — undan keyin. */
  private async handleUpdates(token: string, updates: TgUpdate[]): Promise<void> {
    const replies: { chatId: number; text: string; keyboard?: TgInlineKeyboard; name: string }[] = [];
    let changed = false;
    await transaction(this.dataSource, async (em) => {
      await em.query(`SELECT 1 FROM settings WHERE key = $1 FOR UPDATE`, [CONFIG_KEY]);
      const config = await this.config(em);
      if (config.token !== token) return;
      let offset = config.offset;
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        const message = update.message;
        if (message?.from && !message.from.is_bot && message.chat.type === 'private') {
          const at = new Date(message.date * 1000);
          await this.upsertSubscriber(em, message.from, at, 'active');
          await em.increment(TelegramSubscriber, { id: message.from.id }, 'messages', 1);
          const text =
            message.text ??
            message.caption ??
            (message.contact ? `📱 ${message.contact.phone_number}` : '[fayl / stiker]');
          await em
            .createQueryBuilder()
            .insert()
            .into(TelegramMessage)
            .values({
              id: `in-${update.update_id}`,
              chatId: message.chat.id,
              direction: 'in',
              name: fullName(message.from),
              text,
              at,
            })
            .orIgnore()
            .execute();
          changed = true;
          if (/^\/start(\s|$)/.test(message.text ?? '') && config.welcome.enabled) {
            const uz = subscriberLang(message.from.language_code) === 'uz';
            replies.push({
              chatId: message.chat.id,
              text: uz ? config.welcome.uz : config.welcome.ru,
              keyboard: webAppKeyboard(
                uz ? config.welcome.buttonUz : config.welcome.buttonRu,
                config.miniAppUrl,
              ),
              name: fullName(message.from),
            });
          }
        }
        const member = update.my_chat_member;
        if (member && member.chat.type === 'private' && !member.from.is_bot) {
          // kicked — foydalanuvchi botni to'xtatdi (bloklad); member — qayta ishga tushirdi
          const status = member.new_chat_member.status === 'kicked' ? 'blocked' : 'active';
          await this.upsertSubscriber(em, member.from, new Date(member.date * 1000), status);
          changed = true;
        }
      }
      await this.settings.set(
        CONFIG_KEY,
        { ...config, offset, lastPollAt: new Date().toISOString(), lastError: null },
        em,
      );
    });
    if (changed) this.realtime.changed('telegram');
    for (const reply of replies) {
      await this.sendToChat(
        reply.chatId,
        reply.text,
        { keyboard: reply.keyboard, name: reply.name },
        token,
      ).catch((error: unknown) => this.reportSendError(error));
    }
  }

  private async upsertSubscriber(em: EntityManager, user: TgUser, at: Date, status: 'active' | 'blocked') {
    await em.query(
      `INSERT INTO telegram_subscribers
         (id, "firstName", "lastName", username, "languageCode", "firstSeen", "lastSeen", status, messages)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, 0)
       ON CONFLICT (id) DO UPDATE SET
         "firstName" = EXCLUDED."firstName",
         "lastName" = EXCLUDED."lastName",
         username = EXCLUDED.username,
         "languageCode" = COALESCE(EXCLUDED."languageCode", telegram_subscribers."languageCode"),
         "lastSeen" = GREATEST(telegram_subscribers."lastSeen", EXCLUDED."lastSeen"),
         status = EXCLUDED.status`,
      [
        user.id,
        user.first_name.slice(0, 100),
        user.last_name?.slice(0, 100) ?? null,
        user.username ?? null,
        user.language_code ?? null,
        at,
        status,
      ],
    );
  }

  // ───────────────────────── yordamchilar ─────────────────────────

  private async requireToken(): Promise<TelegramConfig> {
    const config = await this.config();
    if (!config.token) fail('telegram_not_connected');
    return config;
  }

  /** Admin amali: Telegram xatosi → bizning xato kodi (matni — `detail` da). */
  private async adminCall<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof TelegramApiError)) throw error;
      if (error.code === 0) fail('telegram_unreachable', error.message);
      if (error.code === 401 || error.code === 404) fail('telegram_token_invalid');
      fail('telegram_error', describeTelegramError(error));
    }
  }
}
