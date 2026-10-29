import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DATE_KEY, Trim, TrimToUndefined } from '../common/dto';
import { PAYMENT_TYPES, type PaymentType } from '../common/types';

export class ExpenseCategoryDto {
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class ExpenseDto {
  @Matches(DATE_KEY)
  date: string;

  @IsString()
  categoryId: string;

  @IsInt()
  @Min(1)
  @Max(100_000_000_000)
  amount: number;

  @IsIn(PAYMENT_TYPES)
  payment: PaymentType;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(500)
  note?: string;
}

export class ExpensesQuery {
  @IsOptional()
  @Matches(DATE_KEY)
  from?: string;

  @IsOptional()
  @Matches(DATE_KEY)
  to?: string;
}
