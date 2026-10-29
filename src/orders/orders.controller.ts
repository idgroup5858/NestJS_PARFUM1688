import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { OrdersQuery, PosSaleDto, UpdateOrderDto } from './order.dto';
import { OrdersService } from './orders.service';

/** Kassa va admin: buyurtmalar navbati, sotuv, tayyorlash. */
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** `?active=1` — kassa navbati; `?status=done&from=2026-10-01&to=2026-10-29` — tarix. Eng yangisi birinchi. */
  @Get()
  list(@Query() query: OrdersQuery) {
    return this.orders.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  /** Kassa sotuvi (chek) → "Berildi" holatidagi buyurtma. */
  @Post()
  create(@Body() dto: PosSaleDto, @CurrentUser() user: AuthUser) {
    return this.orders.createPosSale(dto, user);
  }

  /** Tara, yetkazish narxi, to'lov turi va / yoki holat (`status`). */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.update(id, dto, user);
  }
}
