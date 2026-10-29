import { addDays, isDateKey, todayKey } from '../common/dates';

/** Mijoz tanlay oladigan soatlar: 10:00 – 21:00 (frontend `CheckoutPage` bilan bir xil). */
export const SLOT_HOURS = Array.from({ length: 12 }, (_, i) => 10 + i);

/** Shu paytda tanlab bo'ladigan vaqtmi: bugun — faqat hali kelmagan soatlar, keyingi ikki kun — hammasi. */
export function slotAvailable(date: string, hour: number, now = new Date()): boolean {
  const today = todayKey(now);
  if (!isDateKey(date) || date < today || date > addDays(today, 2)) return false;
  if (!SLOT_HOURS.includes(hour)) return false;
  return date !== today || hour > now.getHours();
}
