import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import {
  ActiveDto,
  AccordDto,
  BannerDto,
  BrandDto,
  CategoryDto,
  FlakonDto,
  NoteDto,
  ProductDto,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

/**
 * Katalog: o'qish (`GET /catalog`) — har qanday xodim; qo'shish (`POST`), tahrirlash (`PUT` — to'liq yozuv), o'chirish
 * va faollikni almashtirish — faqat admin. Har o'zgarishdan keyin ekranlarga `changed: catalog` va mijozlarga `catalog`.
 */
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async notify<T>(work: Promise<T>, stock = false): Promise<T> {
    const result = await work;
    this.realtime.changed('catalog', ...(stock ? (['stock'] as const) : []));
    this.realtime.catalogChanged();
    return result;
  }

  @Get('catalog')
  all() {
    return this.catalog.all();
  }

  // ── brendlar ──
  @Roles('admin')
  @Post('brands')
  createBrand(@Body() dto: BrandDto) {
    return this.notify(this.catalog.saveBrand(null, dto));
  }

  @Roles('admin')
  @Put('brands/:id')
  updateBrand(@Param('id') id: string, @Body() dto: BrandDto) {
    return this.notify(this.catalog.saveBrand(id, dto));
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('brands/:id')
  removeBrand(@Param('id') id: string) {
    return this.notify(this.catalog.removeBrand(id));
  }

  // ── kategoriyalar ──
  @Roles('admin')
  @Post('categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.notify(this.catalog.saveCategory(null, dto));
  }

  @Roles('admin')
  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: CategoryDto) {
    return this.notify(this.catalog.saveCategory(id, dto));
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.notify(this.catalog.removeCategory(id));
  }

  // ── notalar ──
  @Roles('admin')
  @Post('notes')
  createNote(@Body() dto: NoteDto) {
    return this.notify(this.catalog.saveNote(null, dto));
  }

  @Roles('admin')
  @Put('notes/:id')
  updateNote(@Param('id') id: string, @Body() dto: NoteDto) {
    return this.notify(this.catalog.saveNote(id, dto));
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('notes/:id')
  removeNote(@Param('id') id: string) {
    return this.notify(this.catalog.removeNote(id));
  }

  // ── akkordlar ──
  @Roles('admin')
  @Post('accords')
  createAccord(@Body() dto: AccordDto) {
    return this.notify(this.catalog.saveAccord(null, dto));
  }

  @Roles('admin')
  @Put('accords/:id')
  updateAccord(@Param('id') id: string, @Body() dto: AccordDto) {
    return this.notify(this.catalog.saveAccord(id, dto));
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('accords/:id')
  removeAccord(@Param('id') id: string) {
    return this.notify(this.catalog.removeAccord(id));
  }

  // ── atirlar ──
  @Roles('admin')
  @Post('products')
  createProduct(@Body() dto: ProductDto) {
    return this.notify(this.catalog.saveProduct(null, dto));
  }

  @Roles('admin')
  @Put('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: ProductDto) {
    return this.notify(this.catalog.saveProduct(id, dto), true);
  }

  @Roles('admin')
  @Patch('products/:id/active')
  setProductActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.notify(this.catalog.setProductActive(id, dto.active), true);
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('products/:id')
  removeProduct(@Param('id') id: string) {
    return this.notify(this.catalog.removeProduct(id), true);
  }

  // ── flakonlar (tara) ──
  @Roles('admin')
  @Post('flakons')
  createFlakon(@Body() dto: FlakonDto) {
    return this.notify(this.catalog.saveFlakon(null, dto), true);
  }

  @Roles('admin')
  @Put('flakons/:id')
  updateFlakon(@Param('id') id: string, @Body() dto: FlakonDto) {
    return this.notify(this.catalog.saveFlakon(id, dto), true);
  }

  @Roles('admin')
  @Patch('flakons/:id/active')
  setFlakonActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.notify(this.catalog.setFlakonActive(id, dto.active), true);
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('flakons/:id')
  removeFlakon(@Param('id') id: string) {
    return this.notify(this.catalog.removeFlakon(id), true);
  }

  // ── bannerlar ──
  @Roles('admin')
  @Post('banners')
  createBanner(@Body() dto: BannerDto) {
    return this.notify(this.catalog.saveBanner(null, dto));
  }

  @Roles('admin')
  @Put('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: BannerDto) {
    return this.notify(this.catalog.saveBanner(id, dto));
  }

  @Roles('admin')
  @Patch('banners/:id/active')
  setBannerActive(@Param('id') id: string, @Body() dto: ActiveDto) {
    return this.notify(this.catalog.setBannerActive(id, dto.active));
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete('banners/:id')
  removeBanner(@Param('id') id: string) {
    return this.notify(this.catalog.removeBanner(id));
  }
}
