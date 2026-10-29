import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { CurrentUser } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { fail } from '../common/errors';
import { normalizePhone } from '../common/format';
import { CustomersService } from './customers.service';

class CustomersQuery {
  /** kassa: "90 123 45 67" yoki "998901234567" */
  @IsOptional()
  @Matches(/^[\d\s+()-]{5,20}$/)
  phone?: string;
}

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /**
   * `?phone=` (kassa, istalgan xodim) — shu raqam egasi yoki `null` (ismini avtomatik qo'yish uchun).
   * Telefonsiz (faqat admin) — ro'yxat: buyurtmalar soni, xarid summasi, oxirgi buyurtma.
   */
  @Get()
  list(@Query() query: CustomersQuery, @CurrentUser() user: AuthUser) {
    if (query.phone) return this.customers.byPhone(normalizePhone(query.phone));
    if (user.role !== 'admin') fail('forbidden', user.role);
    return this.customers.list();
  }
}
