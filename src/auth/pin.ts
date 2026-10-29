import { createHmac } from 'node:crypto';

/** PIN: faqat raqamlar, 4 tadan 8 tagacha. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/**
 * PIN xeshi: HMAC-SHA256 (kalit — `PIN_SECRET`). bcrypt emas, chunki kirish faqat PIN bilan (xodim tanlanmaydi) — xesh
 * bo'yicha qidirish kerak. Kalit bazadan tashqarida bo'lsa, baza o'g'irlanganda ham 10 000 variantni sinab bo'lmaydi.
 */
export function pinDigest(secret: string, pin: string): string {
  return createHmac('sha256', secret).update(pin).digest('hex');
}
