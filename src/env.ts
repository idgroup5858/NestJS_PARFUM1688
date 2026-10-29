/**
 * BIRINCHI import (`main.ts`): `.env` yuklanadi va vaqt zonasi o'rnatiladi — "bugun", sana kalitlari va yetkazish
 * soatlari do'kon vaqtida (server qaysi zonada turishidan qat'i nazar).
 */
import { config } from 'dotenv';

config({ quiet: true });
process.env.TZ ||= 'Asia/Tashkent';
