import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TgUser } from './telegram.api';

/** initData shuncha vaqtdan eski bo'lsa qabul qilinmaydi (ushlab olingan ma'lumot bilan uzoq kirib bo'lmasin). */
export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

/**
 * Telegram Mini App `initData` ni tekshiradi (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 * imzo bot tokeni bilan to'g'ri va eskirmagan bo'lsa — foydalanuvchi, aks holda `null`.
 */
export function verifyInitData(initData: string, botToken: string, now = Date.now()): TgUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete('hash');
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > INIT_DATA_MAX_AGE_SEC) return null;
  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TgUser | null;
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}
