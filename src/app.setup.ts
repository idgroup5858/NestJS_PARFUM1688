import { ValidationError, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { appError } from './common/errors';
import { ImagesService } from './images/images.service';

/** Xato xabarlari: `lines.0.qty: qty must not be less than 1` ko'rinishida. */
function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => `${path}: ${message}`);
    return [...own, ...flatten(error.children ?? [], path)];
  });
}

/** `main.ts` va testlar uchun umumiy sozlash. */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  const origins = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors(origins.length ? { origin: origins } : undefined);
  // reverse proxy (nginx) orqasida — urinishlar chegarasi haqiqiy IP bo'yicha ishlasin
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    // noma'lum maydonlar jimgina tashlanadi (frontend `id`, `createdAt`, `unitPrice` yuborsa ham — ular serverda)
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => appError('invalid_input', flatten(errors).join('; ')),
    }),
  );

  // Rasmlar: /images/<papka>/<fayl> (IMAGES_DIR) — kengaytmasi boshqa bo'lsa ham nomi bo'yicha topiladi
  const images = app.get(ImagesService);
  app.getHttpAdapter().get('/images/:folder/:file', async (req: Request, res: Response) => {
    const file = await images.resolve(String(req.params.folder), String(req.params.file));
    if (!file) return void res.status(404).end();
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file, { maxAge: '1d' });
  });
}
