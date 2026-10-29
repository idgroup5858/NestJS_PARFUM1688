import './env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(
    `PARFUM1688 backend: http://localhost:${port}/api (Socket.IO va /images — shu portda, TZ=${process.env.TZ})`,
  );
}
void bootstrap();
