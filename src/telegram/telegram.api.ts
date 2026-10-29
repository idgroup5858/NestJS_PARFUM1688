/** Telegram Bot API — faqat kerakli turlar va chaqiruv (frontend `integrations/telegram/api.ts` dan). */

export interface TgUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TgBotInfo extends TgUser {
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
  has_main_web_app?: boolean;
}

export interface TgChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

export interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: TgChat;
  date: number;
  text?: string;
  caption?: string;
  contact?: { phone_number: string; first_name: string; user_id?: number };
}

export interface TgChatMemberUpdated {
  chat: TgChat;
  from: TgUser;
  date: number;
  new_chat_member: { status: string; user: TgUser };
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  my_chat_member?: TgChatMemberUpdated;
}

export interface TgWebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

export interface TgBotCommand {
  command: string;
  description: string;
}

export type TgMenuButton =
  { type: 'commands' } | { type: 'default' } | { type: 'web_app'; text: string; web_app: { url: string } };

export type TgInlineKeyboard = {
  inline_keyboard: ({ text: string; web_app: { url: string } } | { text: string; url: string })[][];
};

/** Telegram xatosi: `code` — 401 (token noto'g'ri), 403 (botni bloklagan), 409 (webhook yoqilgan), 429...; 0 — tarmoq. */
export class TelegramApiError extends Error {
  constructor(
    readonly code: number,
    description: string,
    readonly retryAfter?: number,
  ) {
    super(description);
  }
}

/** @BotFather bergan token: "123456789:AA...". URL ga qo'yiladi — boshqa belgilar o'tkazilmaydi. */
export const TOKEN_PATTERN = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;

const TIMEOUT_MS = 15_000;

/** Bot API chaqiruvi. Long polling uchun [timeoutMs] kattaroq beriladi. */
export async function callBot<T>(
  token: string,
  method: string,
  params: object = {},
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new TelegramApiError(0, `network: ${(error as Error).message}`);
  }
  const body = (await response.json().catch(() => null)) as
    | { ok: true; result: T }
    | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } }
    | null;
  if (!body) throw new TelegramApiError(response.status, `HTTP ${response.status}`);
  if (!body.ok) throw new TelegramApiError(body.error_code, body.description, body.parameters?.retry_after);
  return body.result;
}

export function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  keyboard?: TgInlineKeyboard,
) {
  return callBot<TgMessage>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    ...(keyboard && { reply_markup: keyboard }),
  });
}

export function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Mini App ochiladigan tugma: Telegram faqat https manzilni qabul qiladi. */
export function webAppKeyboard(text: string, url: string): TgInlineKeyboard | undefined {
  return isHttpsUrl(url) && text.trim()
    ? { inline_keyboard: [[{ text: text.trim(), web_app: { url } }]] }
    : undefined;
}

/** Admin uchun tushunarli xato matni (`lastError`). */
export function describeTelegramError(error: unknown): string {
  if (!(error instanceof TelegramApiError))
    return error instanceof Error ? error.message : "Noma'lum xatolik";
  if (error.code === 0) return "Telegram serveriga ulanib bo'lmadi (internetni tekshiring)";
  if (error.code === 401 || error.code === 404)
    return "Token noto'g'ri yoki bot o'chirilgan (401). @BotFather'dan tokenni qayta oling.";
  if (error.code === 403) return 'Foydalanuvchi botni bloklagan yoki hali /start bosmagan (403).';
  if (error.code === 409) return 'Botda webhook yoqilgan yoki boshqa joyda yangilanishlar olinmoqda (409).';
  if (error.code === 429)
    return `Juda ko'p so'rov — ${error.retryAfter ?? 'bir necha'} soniyadan keyin (429).`;
  if (error.code === 400 && /chat not found/i.test(error.message))
    return 'Chat topilmadi — foydalanuvchi botga hali yozmagan (400).';
  return `${error.message} (${error.code})`;
}
