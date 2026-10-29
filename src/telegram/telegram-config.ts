import type { TgBotInfo } from './telegram.api';

/** Xodim xabarlari tili (bot yuboradigan "Yangi buyurtma" xabari). */
export type StaffLang = 'uz' | 'ru';

/**
 * Bot sozlamalari va holati (`settings` → `telegram`). Token faqat serverda — admin paneliga qaytarilmaydi.
 */
export interface TelegramConfig {
  token: string;
  bot: TgBotInfo | null;
  connectedAt: string | null;
  /** yangilanishlarni (xabarlar, /start) long polling bilan qabul qilish */
  polling: boolean;
  offset: number;
  lastPollAt: string | null;
  lastError: string | null;
  /** botda webhook o'rnatilgan bo'lsa — polling ishlamaydi (409) */
  webhookUrl: string | null;
  miniAppUrl: string;
  menuButtonText: string;
  welcome: { enabled: boolean; ru: string; uz: string; buttonRu: string; buttonUz: string };
  notify: { customers: boolean; staff: boolean; staffChatId: string; staffLang: StaffLang };
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  token: '',
  bot: null,
  connectedAt: null,
  polling: true,
  offset: 0,
  lastPollAt: null,
  lastError: null,
  webhookUrl: null,
  miniAppUrl: '',
  menuButtonText: 'Магазин',
  welcome: {
    enabled: true,
    ru: 'Добро пожаловать в <b>PARFUM1688</b>! ✨\nОригинальные ароматы на розлив от 50 г и запечатанные флаконы. Нажмите кнопку ниже, чтобы открыть магазин.',
    uz: "<b>PARFUM1688</b> ga xush kelibsiz! ✨\nOriginal atirlar 50 g dan quyib beriladi, ochilmagan flakonlar ham bor. Do'konni ochish uchun quyidagi tugmani bosing.",
    buttonRu: 'Открыть магазин',
    buttonUz: "Do'konni ochish",
  },
  notify: { customers: true, staff: false, staffChatId: '', staffLang: 'uz' },
};

/** Saqlangan holat + yangi qo'shilgan maydonlar standart qiymati bilan. */
export function withDefaults(stored: Partial<TelegramConfig> | null): TelegramConfig {
  return {
    ...DEFAULT_TELEGRAM_CONFIG,
    ...stored,
    welcome: { ...DEFAULT_TELEGRAM_CONFIG.welcome, ...stored?.welcome },
    notify: { ...DEFAULT_TELEGRAM_CONFIG.notify, ...stored?.notify },
  };
}

/** Admin paneli uchun: token o'rniga uning boshi va oxiri. */
export function configView(config: TelegramConfig) {
  const { token, offset: _offset, ...rest } = config;
  return {
    ...rest,
    connected: !!token && !!config.bot,
    tokenHint: token ? `${token.slice(0, 6)}…${token.slice(-4)}` : null,
  };
}

/** Telegram tili → xabar tili: o'zbekcha Telegram — o'zbekcha, qolganlari — ruscha (mijoz ilovasining asosiy tili). */
export function subscriberLang(languageCode: string | null | undefined): 'ru' | 'uz' {
  return languageCode?.toLowerCase().startsWith('uz') ? 'uz' : 'ru';
}
