import { createHash, randomBytes } from 'node:crypto';

/** Hujjat id si: `ord_3f2a9c1b7e4d8a05`. Prefiks loglarda qaysi jadvalga tegishliligini ko'rsatadi. */
export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

/** Uzun maxfiy satr (JWT / PIN kalitlari). */
export function newSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Matndan id (frontend `slugify` bilan bir xil): "Louis Vuitton Symphony" → "louis-vuitton-symphony". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

/**
 * Katalog id si matndan (frontend `uniqueId` bilan bir xil): "Dior Sauvage" → "dior-sauvage", band bo'lsa "-2", "-3"...
 * Lotincha harf bo'lmasa — tasodifiy id.
 */
export function uniqueId(text: string, taken: Iterable<string>, prefix = 'id'): string {
  const base = slugify(text) || newId(prefix);
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index++;
  return `${base}-${index}`;
}
