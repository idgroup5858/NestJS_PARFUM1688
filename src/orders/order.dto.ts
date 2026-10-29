import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
import { DATE_KEY, Trim } from '../common/dto';
import {
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_TYPES,
  type OrderSource,
  type OrderStatus,
  type PaymentType,
} from '../common/types';

export class FlakonPickDto {
  @IsString()
  @MaxLength(80)
  flakonId: string;

  /** pullik berildimi (tekin bo'lsa ham ombordan chiqadi) */
  @IsBoolean()
  paid: boolean;
}

export class OrderLineInputDto {
  @IsString()
  @MaxLength(80)
  productId: string;

  /** gram — razliv (qty grammda), bottle — original flakon (qty donada) */
  @IsIn(['gram', 'bottle'])
  kind: 'gram' | 'bottle';

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  qty: number;

  /** faqat razliv qatorida: tara */
  @IsOptional()
  @ValidateNested()
  @Type(() => FlakonPickDto)
  flakon?: FlakonPickDto;
}

/** Kassa sotuvi: darhol "Berildi" bo'lib yaratiladi — tovar shu zahoti ombordan chiqadi. Narxlar bazadan. */
export class PosSaleDto {
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(100)
  name?: string;

  /** bo'sh yoki "90 123 45 67" / "998901234567" */
  @IsOptional()
  @IsString()
  @Matches(/^[\d\s+()-]{0,20}$/)
  phone?: string;

  @IsIn(PAYMENT_TYPES)
  payment: PaymentType;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OrderLineInputDto)
  lines: OrderLineInputDto[];
}

export class LineFlakonDto {
  @IsString()
  @MaxLength(20)
  lineId: string;

  /** `null` — tarasiz */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  flakonId: string | null;

  @IsBoolean()
  paid: boolean;
}

/**
 * Bot buyurtmasini tayyorlash (kassa oynasi): tara, yetkazish narxi, to'lov turi va (ixtiyoriy) yangi holat — bitta
 * so'rovda, bitta tranzaksiyada. Tara faqat tovar ombordan chiqmaguncha o'zgaradi.
 */
export class UpdateOrderDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  deliveryFee?: number;

  @IsOptional()
  @IsIn(PAYMENT_TYPES)
  payment?: PaymentType;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => LineFlakonDto)
  flakons?: LineFlakonDto[];

  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: OrderStatus;
}

export class OrdersQuery {
  /** vergul bilan: "new,accepted" */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsIn(ORDER_STATUSES, { each: true })
  status?: OrderStatus[];

  @IsOptional()
  @IsIn(ORDER_SOURCES)
  source?: OrderSource;

  /** faqat kassa navbatidagilar (new → ready) */
  @IsOptional()
  @Transform(({ value }) => value === '1' || value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;

  /** yaratilgan kun bo'yicha (ikkala chegara ham kiradi) */
  @IsOptional()
  @Matches(DATE_KEY)
  from?: string;

  @IsOptional()
  @Matches(DATE_KEY)
  to?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  limit?: number;
}
