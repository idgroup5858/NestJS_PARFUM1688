import type { Request } from 'express';
import type { Role } from '../common/types';

/** Kirgan xodim — har so'rovda bazadan yangidan olinadi (bloklansa yoki roli o'zgarsa darhol kuchga kiradi). */
export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

/**
 * Mijoz qurilmasi sessiyasi (mijoz ilovasi): Telegram'dan ochilgan bo'lsa — tasdiqlangan Telegram id; birinchi
 * buyurtmadan keyin — mijoz id si ("Мои заказы" shu bo'yicha). Ikkalasi ham yo'q token berilmaydi.
 */
export interface CustomerSession {
  customerId: string | null;
  telegramId: number | null;
}

export interface StaffTokenPayload {
  typ: 'staff';
  sub: string;
}

export interface CustomerTokenPayload {
  typ: 'customer';
  cid?: string;
  tg?: number;
}

export type AuthedRequest = Request & { user?: AuthUser; customer?: CustomerSession | null };
