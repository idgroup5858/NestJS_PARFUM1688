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
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DATE_KEY, Trim, TrimToUndefined } from '../common/dto';
import { WRITE_OFF_REASONS, type WriteOffReason } from '../common/types';

const STOCK_KEY = /^(gram|bottle|flakon):[a-z0-9][a-z0-9_-]{0,79}$/;

export class SupplierDto {
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  /** faqat raqamlar yoki bo'sh */
  @IsString()
  @Matches(/^\d{0,15}$/)
  phone: string;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  note?: string;
}

export class SupplierPaymentDto {
  @IsString()
  supplierId: string;

  @Matches(DATE_KEY)
  date: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000_000)
  amount: number;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  note?: string;
}

class PurchaseLineDto {
  @Matches(STOCK_KEY)
  key: string;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  qty: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitCost: number;
}

export class PurchaseDto {
  @IsString()
  supplierId: string;

  @Matches(DATE_KEY)
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines: PurchaseLineDto[];

  /** shu zahoti to'langan summa; qolgani yetkazib beruvchiga qarz */
  @IsInt()
  @Min(0)
  paid: number;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  note?: string;
}

class InventoryLineDto {
  @Matches(STOCK_KEY)
  key: string;

  /** sanalgan qoldiq */
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  actual: number;
}

export class InventoryDto {
  @Matches(DATE_KEY)
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => InventoryLineDto)
  lines: InventoryLineDto[];

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  note?: string;
}

class WriteOffLineDto {
  @Matches(STOCK_KEY)
  key: string;

  @IsInt()
  @Min(1)
  @Max(10_000_000)
  qty: number;
}

export class WriteOffDto {
  @Matches(DATE_KEY)
  date: string;

  @IsIn(WRITE_OFF_REASONS)
  reason: WriteOffReason;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => WriteOffLineDto)
  lines: WriteOffLineDto[];

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  note?: string;
}

export class DocsQuery {
  @IsOptional()
  @Matches(DATE_KEY)
  from?: string;

  @IsOptional()
  @Matches(DATE_KEY)
  to?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;
}
