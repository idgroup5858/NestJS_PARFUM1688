/**
 * `npm run seed` — bazani tozalab demo ma'lumot yozadi (katalog, xodimlar va 30 kunlik savdo tarixi).
 * `npm run seed -- --base` — faqat katalog, xodimlar va sozlamalar (tarixsiz).
 */
import './cli-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DemoService } from './demo.service';

async function main() {
  const history = !process.argv.includes('--base');
  // modul yuklanishi loglari kerak emas — faqat xato / ogohlantirish va yakuniy hisobot
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const demo = app.get(DemoService);
    const started = Date.now();
    await demo.reset({ history });
    const counts = await demo.counts();
    console.log(
      `${history ? "Demo ma'lumot" : 'Katalog va xodimlar'} yozildi (${process.env.DB_NAME || 'parfum1688'}, ${Date.now() - started} ms):`,
    );
    for (const [table, count] of Object.entries(counts)) console.log(`  ${table.padEnd(20)} ${count}`);
    console.log("Demo PIN'lar: 1111 (admin), 2222, 3333 (kassir)");
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
