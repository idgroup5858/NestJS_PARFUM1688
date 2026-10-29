import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { StockKey } from '../stock/stock-key';
import {
  DocsQuery,
  InventoryDto,
  PurchaseDto,
  SupplierDto,
  SupplierPaymentDto,
  WriteOffDto,
} from './warehouse.dto';
import { WarehouseService } from './warehouse.service';

/** Admin → Ombor: yetkazib beruvchilar, to'lovlar, prixod, inventarizatsiya, spisanie. */
@Roles('admin')
@Controller()
export class WarehouseController {
  constructor(
    private readonly warehouse: WarehouseService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Hujjat ombor qoldig'ini o'zgartirdi — ekranlar va mijoz katalogi ("bor / yo'q") yangilansin. */
  private stockChanged() {
    this.realtime.changed('warehouse', 'stock');
    this.realtime.catalogChanged();
  }

  // ── yetkazib beruvchilar ──
  @Get('suppliers')
  suppliers() {
    return this.warehouse.suppliers();
  }

  @Post('suppliers')
  async createSupplier(@Body() dto: SupplierDto) {
    const supplier = await this.warehouse.saveSupplier(null, dto);
    this.realtime.changed('warehouse');
    return supplier;
  }

  @Put('suppliers/:id')
  async updateSupplier(@Param('id') id: string, @Body() dto: SupplierDto) {
    const supplier = await this.warehouse.saveSupplier(id, dto);
    this.realtime.changed('warehouse');
    return supplier;
  }

  @HttpCode(204)
  @Delete('suppliers/:id')
  async removeSupplier(@Param('id') id: string) {
    await this.warehouse.removeSupplier(id);
    this.realtime.changed('warehouse');
  }

  @Get('supplier-payments')
  payments(@Query() query: DocsQuery) {
    return this.warehouse.payments(query);
  }

  @Post('supplier-payments')
  async createPayment(@Body() dto: SupplierPaymentDto, @CurrentUser() user: AuthUser) {
    const payment = await this.warehouse.createPayment(dto, user.id);
    this.realtime.changed('warehouse');
    return payment;
  }

  // ── prixod ──
  @Get('purchases')
  purchases(@Query() query: DocsQuery) {
    return this.warehouse.purchases(query);
  }

  @Get('purchases/:id')
  purchase(@Param('id') id: string) {
    return this.warehouse.purchase(id);
  }

  @Post('purchases')
  async createPurchase(@Body() dto: PurchaseDto, @CurrentUser() user: AuthUser) {
    const purchase = await this.warehouse.createPurchase(dto, user.id);
    this.stockChanged();
    return purchase;
  }

  // ── inventarizatsiya ──
  @Get('inventories')
  inventories(@Query() query: DocsQuery) {
    return this.warehouse.inventories(query);
  }

  @Get('inventories/:id')
  inventory(@Param('id') id: string) {
    return this.warehouse.inventory(id);
  }

  @Post('inventories')
  async createInventory(@Body() dto: InventoryDto, @CurrentUser() user: AuthUser) {
    const inventory = await this.warehouse.createInventory(
      {
        date: dto.date,
        note: dto.note,
        lines: dto.lines.map((line) => ({ key: line.key as StockKey, actual: line.actual })),
      },
      user.id,
    );
    this.stockChanged();
    return inventory;
  }

  // ── spisanie ──
  @Get('write-offs')
  writeOffs(@Query() query: DocsQuery) {
    return this.warehouse.writeOffs(query);
  }

  @Get('write-offs/:id')
  writeOff(@Param('id') id: string) {
    return this.warehouse.writeOff(id);
  }

  @Post('write-offs')
  async createWriteOff(@Body() dto: WriteOffDto, @CurrentUser() user: AuthUser) {
    const writeOff = await this.warehouse.createWriteOff(
      {
        date: dto.date,
        reason: dto.reason,
        note: dto.note,
        lines: dto.lines.map((line) => ({ key: line.key as StockKey, qty: line.qty })),
      },
      user.id,
    );
    this.stockChanged();
    return writeOff;
  }
}
