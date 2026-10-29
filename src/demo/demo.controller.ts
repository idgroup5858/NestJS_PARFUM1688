import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Public, Roles } from '../auth/decorators';
import { fail } from '../common/errors';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { demoEnabled, DemoService } from './demo.service';

@Roles('admin')
@Controller('demo')
export class DemoController {
  constructor(
    private readonly demo: DemoService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Demo rejimimi va kirish sahifasidagi PIN'lar (`DEMO=1` bo'lmasa — `{ demo: false, pins: [] }`). */
  @Public()
  @Get()
  async info() {
    return { demo: demoEnabled(), pins: await this.demo.pins() };
  }

  /** Admin → Sozlamalar → "Demo ma'lumotlarni tiklash" (faqat `DEMO=1`). Xodimlar ham tiklanadi — qayta kirish kerak. */
  @HttpCode(204)
  @Post('reset')
  async reset() {
    if (!demoEnabled()) fail('demo_disabled');
    await this.demo.reset({ history: true });
    this.realtime.changed('all');
    this.realtime.catalogChanged();
  }
}
