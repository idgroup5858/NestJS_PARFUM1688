import { Body, Controller, Delete, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { Roles } from '../auth/decorators';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ReviewsService } from './reviews.service';

class HiddenDto {
  @IsBoolean()
  hidden: boolean;
}

/** Admin → Sharhlar: yashirish / ko'rsatish, o'chirish. */
@Roles('admin')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  all() {
    return this.reviews.all();
  }

  @Patch(':id')
  async setHidden(@Param('id') id: string, @Body() dto: HiddenDto) {
    const review = await this.reviews.setHidden(id, dto.hidden);
    this.realtime.changed('reviews');
    this.realtime.catalogChanged();
    return review;
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.reviews.remove(id);
    this.realtime.changed('reviews');
    this.realtime.catalogChanged();
  }
}
