import { Controller, Get, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DataSource } from 'typeorm';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { Flakon, Product } from '../catalog/entities';
import { SettingsService } from '../settings/settings.service';
import { parseStockKey, stockUnit } from './stock-key';
import { StockMovement } from './stock.entities';
import { isLowStock, isOnSale, StockService } from './stock.service';

class MovementsQuery {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number;
}

@Controller('stock')
export class StockController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stock: StockService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Ombor qoldiqlari: har pozitsiya — nomi, birligi, qoldig'i, sotuvdami va kam qolganmi. Tannarx (`avgCost`) — faqat
   * admin uchun.
   */
  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const em = this.dataSource.manager;
    const [keys, products, flakons, settings] = await Promise.all([
      this.stock.allKeys(em),
      em.find(Product),
      em.find(Flakon),
      this.settings.shop(),
    ]);
    const balances = await this.stock.balances(em, keys);
    const productById = new Map(products.map((item) => [item.id, item]));
    const flakonById = new Map(flakons.map((item) => [item.id, item]));
    return keys.map((key) => {
      const { kind, id } = parseStockKey(key)!;
      const balance = balances.get(key)!;
      const onSale = isOnSale(key, productById, flakonById);
      const product = kind === 'flakon' ? undefined : productById.get(id);
      return {
        key,
        kind,
        itemId: id,
        name: kind === 'flakon' ? (flakonById.get(id)?.name ?? id) : (product?.name ?? id),
        ...(kind === 'bottle' && product?.bottle && { volumeMl: product.bottle.volumeMl }),
        unit: stockUnit(key),
        qty: balance.qty,
        ...(user.role === 'admin' && { avgCost: balance.avgCost }),
        onSale,
        low: isLowStock(key, balance.qty, onSale, settings),
      };
    });
  }

  /** Ombor harakatlari (eng yangisi birinchi): pozitsiya yoki hujjat bo'yicha. */
  @Roles('admin')
  @Get('movements')
  movements(@Query() query: MovementsQuery) {
    return this.dataSource.manager.find(StockMovement, {
      where: {
        ...(query.key && { key: query.key as StockMovement['key'] }),
        ...(query.refId && { refId: query.refId }),
      },
      order: { at: 'DESC' },
      take: query.limit ?? 500,
    });
  }
}
