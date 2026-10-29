import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches } from 'class-validator';
import { fail } from '../common/errors';
import { AttemptsGuard } from './attempts.guard';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { CurrentUser, Public } from './decorators';
import { isValidPin } from './pin';

class LoginDto {
  @IsString()
  @Matches(/^\d+$/)
  pin: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** PIN bilan kirish → `{ token, user }`. Bir IP dan daqiqasiga 10 ta urinish. */
  @Public()
  @UseGuards(AttemptsGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    if (!isValidPin(dto.pin)) fail('wrong_pin');
    return this.auth.login(dto.pin);
  }

  /** Joriy xodim (token tekshiruvi — sahifa yangilanganda). */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
