/**
 * PARFUM1688 ma'lumotlar modeli turlari — frontend `src/domain/types.ts` bilan bir xil (API shartnomasi).
 * Pul — butun so'm (UZS), vaqt — ISO satr, sana — "YYYY-MM-DD".
 */

export const LANGS = ['ru', 'uz'] as const;
export type Lang = (typeof LANGS)[number];
export type Localized = Record<Lang, string>;

export const ROLES = ['admin', 'cashier'] as const;
export type Role = (typeof ROLES)[number];

export const CATEGORY_GROUPS = ['family', 'class'] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const GENDERS = ['female', 'male', 'unisex'] as const;
export type Gender = (typeof GENDERS)[number];

export const SEASONS = ['summer', 'spring', 'autumn', 'winter', 'universal', 'evening'] as const;
export type SeasonPreset = (typeof SEASONS)[number];

export const LONGEVITY_LEVELS = ['very_weak', 'weak', 'moderate', 'long', 'eternal'] as const;
export type LongevityLevel = (typeof LONGEVITY_LEVELS)[number];

export const SILLAGE_LEVELS = ['intimate', 'moderate', 'strong', 'enormous'] as const;
export type SillageLevel = (typeof SILLAGE_LEVELS)[number];

export const MOVEMENT_REASONS = ['initial', 'purchase', 'sale', 'return', 'writeoff', 'inventory'] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];

export const WRITE_OFF_REASONS = ['spill', 'damage', 'tester', 'expired', 'other'] as const;
export type WriteOffReason = (typeof WRITE_OFF_REASONS)[number];

export const PAYMENT_TYPES = ['cash', 'card', 'click', 'payme'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const ORDER_SOURCES = ['bot', 'pos'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const FULFILLMENTS = ['pickup', 'delivery'] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export const ORDER_STATUSES = ['new', 'accepted', 'preparing', 'ready', 'done', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
