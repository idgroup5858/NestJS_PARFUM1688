import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IMAGE_PATH, LocalizedDto, Trim, TrimToUndefined } from '../common/dto';
import {
  CATEGORY_GROUPS,
  GENDERS,
  LONGEVITY_LEVELS,
  SEASONS,
  SILLAGE_LEVELS,
  type CategoryGroup,
  type Gender,
  type LongevityLevel,
  type SeasonPreset,
  type SillageLevel,
} from '../common/types';

const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export class BrandDto {
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @TrimToUndefined()
  @MaxLength(60)
  country?: string;
}

export class CategoryDto {
  @ValidateNested()
  @Type(() => LocalizedDto)
  name: LocalizedDto;

  @IsIn(CATEGORY_GROUPS)
  group: CategoryGroup;

  /** aromat oilasi uchun majburiy (bosh sahifada ko'rinadi) */
  @IsString()
  @Matches(IMAGE_PATH)
  image: string;

  @IsInt()
  @Min(-10_000)
  @Max(10_000)
  sort: number;
}

export class NoteDto {
  @ValidateNested()
  @Type(() => LocalizedDto)
  name: LocalizedDto;

  @IsString()
  @Matches(IMAGE_PATH)
  image: string;
}

export class AccordDto {
  @ValidateNested()
  @Type(() => LocalizedDto)
  name: LocalizedDto;

  /** "#f6e05e" */
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color: string;
}

class ProductNotesDto {
  @IsArray()
  @ArrayMaxSize(30)
  @Matches(ID, { each: true })
  top: string[];

  @IsArray()
  @ArrayMaxSize(30)
  @Matches(ID, { each: true })
  middle: string[];

  @IsArray()
  @ArrayMaxSize(30)
  @Matches(ID, { each: true })
  base: string[];
}

class ProductBottleDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  volumeMl: number;

  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  price: number;
}

export class ProductDto {
  @IsString()
  @Trim()
  @MaxLength(150)
  name: string;

  @IsString()
  @Matches(ID)
  brandId: string;

  @IsArray()
  @ArrayMaxSize(30)
  @Matches(ID, { each: true })
  categoryIds: string[];

  @IsIn(GENDERS)
  gender: Gender;

  @IsString()
  @Matches(IMAGE_PATH)
  image: string;

  @ValidateNested()
  @Type(() => LocalizedDto)
  description: LocalizedDto;

  @ValidateNested()
  @Type(() => ProductNotesDto)
  notes: ProductNotesDto;

  @IsArray()
  @ArrayMaxSize(20)
  @Matches(ID, { each: true })
  accords: string[];

  @IsIn(SEASONS)
  season: SeasonPreset;

  @IsIn(LONGEVITY_LEVELS)
  longevity: LongevityLevel;

  @IsIn(SILLAGE_LEVELS)
  sillage: SillageLevel;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  pricePerGram: number;

  /** `null` — faqat razliv */
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductBottleDto)
  bottle: ProductBottleDto | null;

  @IsBoolean()
  isNew: boolean;

  @IsBoolean()
  active: boolean;
}

export class FlakonDto {
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsInt()
  @Min(1)
  @Max(100_000)
  volumeMl: number;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price: number;

  @IsString()
  @Matches(IMAGE_PATH)
  image: string;

  @IsBoolean()
  active: boolean;
}

export class BannerDto {
  @ValidateNested()
  @Type(() => LocalizedDto)
  title: LocalizedDto;

  @ValidateNested()
  @Type(() => LocalizedDto)
  subtitle: LocalizedDto;

  @ValidateNested()
  @Type(() => LocalizedDto)
  button: LocalizedDto;

  /** ilova ichidagi manzil ("/catalog?filter=new") yoki https havola */
  @IsString()
  @Trim()
  @MaxLength(300)
  @Matches(/^$|^\/(?![/\\])\S*$|^https:\/\/\S+$/)
  link: string;

  @IsString()
  @Matches(IMAGE_PATH)
  image: string;

  @IsBoolean()
  active: boolean;

  @IsInt()
  @Min(-10_000)
  @Max(10_000)
  sort: number;
}

export class ActiveDto {
  @IsBoolean()
  active: boolean;
}
