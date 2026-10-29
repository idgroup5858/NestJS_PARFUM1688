import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../common/dto';
import { ROLES, type Role } from '../common/types';

export class CreateUserDto {
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsIn(ROLES)
  role: Role;

  /** 4–8 raqam, boshqa xodimda bo'lmasin */
  @IsString()
  @Matches(/^\d{4,8}$/)
  pin: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

/** PIN berilmasa — o'zgarmaydi (admin PIN'ni ko'rmaydi, faqat yangisini qo'yadi). */
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4,8}$/)
  pin?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
