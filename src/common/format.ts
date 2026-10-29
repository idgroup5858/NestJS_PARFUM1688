/** Telegram xabarlari uchun formatlash — frontend `lib/format.ts` bilan bir xil ko'rinish. */

/** Uzilmaydigan bo'shliq: "1 490 000 so'm" ikki qatorga bo'linmasin. */
export const NBSP = ' ';

/** 1234567 → "1 234 567" */
export function formatNumber(value: number): string {
  const fixed = Math.round(value);
  const grouped = String(Math.abs(fixed)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${fixed < 0 ? '−' : ''}${grouped}`;
}

/** Buyurtma raqami: 7 → "#0007" */
export function formatOrderNumber(number: number): string {
  return `#${String(number).padStart(4, '0')}`;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "23.10.2026" — "YYYY-MM-DD" dan */
export function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d}.${m}.${y}`;
}

/** "14:05" */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "+998 90 123 45 67" — 12 raqamli O'zbekiston raqami; boshqasi o'zgarishsiz */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 12 || !digits.startsWith('998')) return phone;
  return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
}

/** Kassada kiritilgan raqam: "90 123 45 67" → "998901234567" (9 raqam bo'lsa 998 qo'shiladi). */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.length === 9 ? `998${digits}` : digits;
}

/** To'liq O'zbekiston raqami: 998 + 9 raqam. */
export function isUzPhone(phone: string): boolean {
  return /^998\d{9}$/.test(phone);
}

/** HTML parse_mode uchun matnni xavfsiz qilish (foydalanuvchi ismi, atir nomi...). */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}
