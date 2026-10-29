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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim } from '../common/dto';
import { AUDIENCES, type Audience } from './broadcasts.service';

const HTTPS_OR_EMPTY = /^$|^https:\/\/\S+$/;

export class ConnectDto {
  @IsString()
  @Trim()
  @MaxLength(100)
  token: string;
}

class WelcomeDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  ru?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  uz?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(64)
  buttonRu?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(64)
  buttonUz?: string;
}

class NotifyDto {
  @IsOptional()
  @IsBoolean()
  customers?: boolean;

  @IsOptional()
  @IsBoolean()
  staff?: boolean;

  /** shaxsiy chat id, guruh id ("-100...") yoki "@kanal" */
  @IsOptional()
  @IsString()
  @Trim()
  @Matches(/^$|^-?\d{1,20}$|^@[A-Za-z0-9_]{4,64}$/)
  staffChatId?: string;

  @IsOptional()
  @IsIn(['uz', 'ru'])
  staffLang?: 'uz' | 'ru';
}

export class TelegramSettingsDto {
  /** Mini App manzili — faqat https (Telegram talabi) yoki bo'sh */
  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(300)
  @Matches(HTTPS_OR_EMPTY)
  miniAppUrl?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(64)
  menuButtonText?: string;

  @IsOptional()
  @IsBoolean()
  polling?: boolean;

  /** oxirgi xato xabarini yopish (admin ko'rdi) */
  @IsOptional()
  @IsBoolean()
  clearError?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WelcomeDto)
  welcome?: WelcomeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotifyDto)
  notify?: NotifyDto;
}

class CommandDto {
  @Matches(/^[a-z0-9_]{1,32}$/)
  command: string;

  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(256)
  description: string;
}

export class CommandsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CommandDto)
  commands: CommandDto[];
}

export class DescriptionDto {
  @IsString()
  @MaxLength(512)
  description: string;

  @IsString()
  @MaxLength(120)
  shortDescription: string;
}

export class MenuButtonDto {
  @IsIn(['web_app', 'commands', 'default'])
  type: 'web_app' | 'commands' | 'default';

  @ValidateIf((dto: MenuButtonDto) => dto.type === 'web_app')
  @IsString()
  @Trim()
  @MinLength(1)
  @MaxLength(64)
  text?: string;

  @ValidateIf((dto: MenuButtonDto) => dto.type === 'web_app')
  @IsString()
  @Matches(/^https:\/\/\S+$/)
  url?: string;
}

export class SendMessageDto {
  @IsString()
  @Matches(/^-?\d{1,20}$|^@[A-Za-z0-9_]{4,64}$/)
  chatId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text: string;
}

export class MessagesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  chatId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export class BroadcastDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text: string;

  @IsIn(AUDIENCES)
  audience: Audience;

  /** Mini App tugmasi (bot sozlamasida https manzil bo'lsa) */
  @IsOptional()
  @IsBoolean()
  withButton?: boolean;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(64)
  buttonText?: string;
}

export class BroadcastTestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  text: string;

  @IsOptional()
  @IsBoolean()
  withButton?: boolean;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(64)
  buttonText?: string;
}
