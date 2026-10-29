import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DATE_KEY, Trim, TrimToUndefined } from '../common/dto';
import { FULFILLMENTS, type Fulfillment } from '../common/types';

export class SessionDto {
  /** Telegram Mini App `WebApp.initData` (o'zgartirilmagan holda) */
  @IsString()
  @MaxLength(4096)
  initData: string;
}

class ShopLineDto {
  @IsString()
  @MaxLength(80)
  productId: string;

  @IsIn(['gram', 'bottle'])
  kind: 'gram' | 'bottle';

  @IsInt()
  @Min(1)
  @Max(100_000)
  qty: number;
}

class SlotDto {
  @Matches(DATE_KEY)
  date: string;

  @IsInt()
  @Min(0)
  @Max(23)
  hour: number;
}

export class ShopOrderDto {
  @IsString()
  @Trim()
  @MaxLength(100)
  name: string;

  /** faqat raqamlar: "998901234567" */
  @IsString()
  @Matches(/^\d{0,15}$/)
  phone: string;

  @IsIn(FULFILLMENTS)
  fulfillment: Fulfillment;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  address?: string;

  @ValidateNested()
  @Type(() => SlotDto)
  slot: SlotDto;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(1000)
  comment?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ShopLineDto)
  lines: ShopLineDto[];
}

export class ReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @Trim()
  @MaxLength(1000)
  text: string;
}
