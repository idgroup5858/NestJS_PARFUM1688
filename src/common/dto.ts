import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

/** Ikki tilli matn: `{ ru, uz }`. Bo'sh bo'lishi mumkin — majburiyligini servis tekshiradi (xato kodi bilan). */
export class LocalizedDto {
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  ru: string;

  @IsString()
  @MaxLength(2000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  uz: string;
}

/** Bosh va oxiridagi bo'shliqlarni olib tashlaydi (satr bo'lsa). */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Bo'sh satr → `undefined` (ixtiyoriy izohlar: "" yuborilsa ham saqlanmaydi). */
export const TrimToUndefined = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value));

/** Rasm yo'li: "perfumes/dior-sauvage.png" (papka / fayl) yoki bo'sh. */
export const IMAGE_PATH = /^$|^[a-z0-9_-]+\/[A-Za-z0-9._-]+$/;

/** Sana kaliti "YYYY-MM-DD" (haqiqiyligi servisda `isDateKey` bilan). */
export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
