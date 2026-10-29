import { Controller, DynamicModule, Get, Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { AuthModule } from './auth/auth.module';
import { Public } from './auth/decorators';
import { CatalogModule } from './catalog/catalog.module';
import { CustomersModule } from './customers/customers.module';
import { DatabaseModule } from './database/database.module';
import { DemoModule } from './demo/demo.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ImagesModule } from './images/images.module';
import { OrdersModule } from './orders/orders.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SettingsModule } from './settings/settings.module';
import { ShopModule } from './shop/shop.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { StockModule } from './stock/stock.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';
import { WarehouseModule } from './warehouse/warehouse.module';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true, time: new Date().toISOString(), tz: process.env.TZ };
  }
}

/**
 * Tayyor web ilova (`UI_DIST`, standart — `../ReactJS_PARFUM1688/dist`) — `/` da; `/api`, `/socket.io`, `/images` dan
 * tashqari hamma yo'l index.html ga (SPA). Papka bo'lmasa — faqat API (ishlab chiqishda UI Vite'da, 5173).
 */
function uiModule(): DynamicModule[] {
  const dir = process.env.UI_DIST || '../ReactJS_PARFUM1688/dist';
  const rootPath = isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
  if (!existsSync(join(rootPath, 'index.html'))) {
    new Logger('UI').warn(`Web ilova topilmadi (${rootPath}) — faqat API ishlaydi`);
    return [];
  }
  return [
    ServeStaticModule.forRoot({
      rootPath,
      exclude: ['/api/{*path}', '/socket.io/{*path}', '/images/{*path}'],
    }),
  ];
}

@Module({
  imports: [
    // .env birinchi yuklanadi — quyidagi modullar process.env dan o'qiydi
    ConfigModule.forRoot({ isGlobal: true }),
    // faqat `AttemptsGuard` qo'yilgan endpointlarda (PIN bilan kirish, mijoz buyurtmasi va sharhi)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      skipIf: () => process.env.THROTTLE === 'off',
    }),
    DatabaseModule,
    SettingsModule,
    AuthModule,
    RealtimeModule,
    StockModule,
    CustomersModule,
    TelegramModule,
    OrdersModule,
    ReviewsModule,
    UsersModule,
    CatalogModule,
    WarehouseModule,
    ExpensesModule,
    ImagesModule,
    ShopModule,
    SnapshotModule,
    DemoModule,
    ...uiModule(),
  ],
  controllers: [HealthController],
})
export class AppModule {}
