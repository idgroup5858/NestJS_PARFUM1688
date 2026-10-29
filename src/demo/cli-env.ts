/**
 * CLI buyruqlari muhiti — BIRINCHI import bo'lishi shart: `AppModule` baholanishidan oldin `.env` yuklanadi va fon
 * ishlari o'chiriladi.
 */
import { config } from 'dotenv';

config({ quiet: true });
process.env.TZ ||= 'Asia/Tashkent';

// seed paytida bot ishga tushmasin (ishlab turgan server bilan 409 to'qnashuvi)
process.env.TELEGRAM = 'off';
// seed o'zi yozadi — bo'sh bazadagi avtomatik yozish ikkinchi marta ishlamasin
process.env.SEED_ON_START = 'off';
