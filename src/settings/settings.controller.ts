import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UpdateShopSettingsDto } from './settings.dto';
import { SettingsService } from './settings.service';

/** Do'kon sozlamalari: o'qish — har qanday xodim (kassa: chek matni, kam qolish chegarasi), o'zgartirish — admin. */
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  get() {
    return this.settings.shop();
  }

  @Roles('admin')
  @Patch()
  async update(@Body() dto: UpdateShopSettingsDto) {
    const gramChips = dto.gramChips && [...new Set(dto.gramChips)].sort((a, b) => a - b);
    const result = await this.settings.updateShop({ ...dto, ...(gramChips && { gramChips }) });
    this.realtime.changed('settings');
    this.realtime.catalogChanged();
    return result;
  }
}
