/**
 * Sana kalitlari "YYYY-MM-DD" — server vaqt zonasida (`.env` → TZ=Asia/Tashkent), frontend `lib/dates.ts` bilan bir xil.
 */

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now = new Date()): string {
  return toDateKey(now);
}

/** "YYYY-MM-DD" + n kun */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

/** Kun boshi (mahalliy 00:00) — davr filtrlari uchun. */
export function startOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Haqiqiy sana kalitimi: "2026-02-30" — yo'q. */
export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateKey(startOfDay(value)) === value;
}
