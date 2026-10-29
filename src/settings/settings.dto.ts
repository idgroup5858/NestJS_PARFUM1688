import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../common/dto';

/** Admin → Sozlamalar: faqat yuborilgan maydonlar o'zgaradi. */
export class UpdateShopSettingsDto {
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerAccentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  minGrams?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(100_000, { each: true })
  gramChips?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockGrams?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockPieces?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receiptFooter?: string;
}
