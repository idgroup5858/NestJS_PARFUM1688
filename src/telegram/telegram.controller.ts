import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { BroadcastsService } from './broadcasts.service';
import {
  BroadcastDto,
  BroadcastTestDto,
  CommandsDto,
  ConnectDto,
  DescriptionDto,
  MenuButtonDto,
  MessagesQuery,
  SendMessageDto,
  TelegramSettingsDto,
} from './telegram.dto';
import { TelegramService } from './telegram.service';

const DEFAULT_BUTTON = "Do'konni ochish · Открыть магазин";

/** Admin → Integratsiya → Telegram. Token serverda saqlanadi, javoblarda faqat `tokenHint`. */
@Roles('admin')
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    private readonly broadcasts: BroadcastsService,
  ) {}

  @Get()
  status() {
    return this.telegram.status();
  }

  @HttpCode(200)
  @Post('connect')
  connect(@Body() dto: ConnectDto) {
    return this.telegram.connect(dto.token);
  }

  @HttpCode(200)
  @Post('refresh')
  refresh() {
    return this.telegram.refresh();
  }

  @HttpCode(200)
  @Post('disconnect')
  disconnect() {
    return this.telegram.disconnect();
  }

  @HttpCode(200)
  @Post('delete-webhook')
  deleteWebhook() {
    return this.telegram.deleteWebhook();
  }

  @Patch('settings')
  updateSettings(@Body() dto: TelegramSettingsDto) {
    return this.telegram.updateSettings(dto);
  }

  // ── bot profili ──
  @Get('profile')
  profile() {
    return this.telegram.profile();
  }

  @HttpCode(204)
  @Put('commands')
  setCommands(@Body() dto: CommandsDto) {
    return this.telegram.setCommands(dto.commands);
  }

  @HttpCode(204)
  @Put('description')
  setDescription(@Body() dto: DescriptionDto) {
    return this.telegram.setDescription(dto.description.trim(), dto.shortDescription.trim());
  }

  @HttpCode(204)
  @Put('menu-button')
  setMenuButton(@Body() dto: MenuButtonDto) {
    return this.telegram.setMenuButton(
      dto.type === 'web_app'
        ? { type: 'web_app', text: dto.text!, web_app: { url: dto.url! } }
        : { type: dto.type },
    );
  }

  // ── obunachilar va xabarlar ──
  @Get('subscribers')
  subscribers() {
    return this.telegram.subscribers();
  }

  @Get('messages')
  messages(@Query() query: MessagesQuery) {
    return this.telegram.messages(query.chatId, query.limit ?? 200);
  }

  @HttpCode(204)
  @Post('messages')
  send(@Body() dto: SendMessageDto) {
    return this.telegram.adminSend(dto.chatId, dto.text);
  }

  // ── rassilka ──
  @Get('broadcasts')
  broadcastList() {
    return this.broadcasts.list();
  }

  @Post('broadcasts')
  async broadcast(@Body() dto: BroadcastDto, @CurrentUser() user: AuthUser) {
    const keyboard = await this.broadcasts.keyboard(dto.withButton ?? true, dto.buttonText || DEFAULT_BUTTON);
    return this.broadcasts.start({ text: dto.text, audience: dto.audience, keyboard }, user.id);
  }

  @HttpCode(204)
  @Post('broadcasts/test')
  async test(@Body() dto: BroadcastTestDto) {
    const keyboard = await this.broadcasts.keyboard(dto.withButton ?? true, dto.buttonText || DEFAULT_BUTTON);
    await this.broadcasts.test(dto.text, keyboard);
  }

  @HttpCode(200)
  @Post('broadcasts/:id/stop')
  stop(@Param('id') id: string) {
    return this.broadcasts.stop(id);
  }
}
