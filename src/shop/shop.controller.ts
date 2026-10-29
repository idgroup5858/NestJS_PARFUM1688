import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AttemptsGuard } from '../auth/attempts.guard';
import type { CustomerSession } from '../auth/auth.types';
import { CurrentCustomer, CustomerAuth, Public } from '../auth/decorators';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ReviewDto, SessionDto, ShopOrderDto } from './shop.dto';
import { ShopService } from './shop.service';

/**
 * Mijoz ilovasi API. Token — `Authorization: Bearer <mijoz tokeni>` (`/shop/session` yoki birinchi buyurtmadan keyin
 * beriladi; ilova uni saqlab qo'yadi).
 */
@Controller('shop')
export class ShopController {
  constructor(
    private readonly shop: ShopService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Public()
  @Get('catalog')
  catalog() {
    return this.shop.catalog();
  }

  /** Telegram Mini App: `initData` → qurilma tokeni. */
  @Public()
  @UseGuards(AttemptsGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('session')
  session(@Body() dto: SessionDto) {
    return this.shop.session(dto.initData);
  }

  @CustomerAuth()
  @Get('me')
  me(@CurrentCustomer() session: CustomerSession) {
    return this.shop.me(session);
  }

  /** Buyurtma berish (tokensiz ham — birinchi buyurtma). Javobda yangi token. Bir IP dan daqiqasiga 10 ta. */
  @CustomerAuth({ optional: true })
  @UseGuards(AttemptsGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('orders')
  placeOrder(@Body() dto: ShopOrderDto, @CurrentCustomer() session: CustomerSession | null) {
    return this.shop.placeOrder(dto, session);
  }

  @CustomerAuth()
  @Get('orders')
  myOrders(@CurrentCustomer() session: CustomerSession) {
    return this.shop.myOrders(session);
  }

  @CustomerAuth()
  @Get('orders/:id')
  myOrder(@CurrentCustomer() session: CustomerSession, @Param('id') id: string) {
    return this.shop.myOrder(session, id);
  }

  @CustomerAuth({ optional: true })
  @Get('products/:id/reviews')
  reviews(@Param('id') id: string, @CurrentCustomer() session: CustomerSession | null) {
    return this.shop.productReviews(id, session);
  }

  @CustomerAuth()
  @UseGuards(AttemptsGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('products/:id/reviews')
  async writeReview(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @CurrentCustomer() session: CustomerSession,
  ) {
    const review = await this.shop.writeReview(id, session, dto.rating, dto.text);
    this.realtime.changed('reviews');
    this.realtime.catalogChanged();
    return review;
  }
}
