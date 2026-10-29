import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { fail } from '../common/errors';
import { newSecret } from '../common/ids';
import { SettingsService } from '../settings/settings.service';
import { User } from '../users/user.entity';
import type { AuthUser, CustomerSession, CustomerTokenPayload, StaffTokenPayload } from './auth.types';
import { pinDigest } from './pin';

/** Kassa kun bo'yi ochiq turadi. */
const STAFF_TOKEN_TTL = '24h';
/** Mijoz qurilmasi — uzoq ("Мои заказы" yo'qolib qolmasin). */
const CUSTOMER_TOKEN_TTL = '365d';

export function toAuthUser(user: User): AuthUser {
  return { id: user.id, name: user.name, role: user.role };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger('Auth');
  private jwtSecret = '';
  private pinSecret = '';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly settings: SettingsService,
    private readonly jwt: JwtService,
  ) {}

  /** Kalitlar `.env` dan; bo'lmasa — bazada bir marta yaratilib saqlanadi. */
  async onModuleInit() {
    this.jwtSecret = await this.secret('JWT_SECRET', 'jwtSecret');
    this.pinSecret = await this.secret('PIN_SECRET', 'pinSecret');
  }

  private async secret(envName: string, settingKey: string): Promise<string> {
    const fromEnv = process.env[envName]?.trim();
    if (fromEnv) return fromEnv;
    const stored = await this.settings.get<string>(settingKey);
    if (stored) return stored;
    const created = newSecret(32);
    await this.settings.set(settingKey, created);
    this.logger.warn(`${envName} .env da yo'q — yangi kalit yaratildi va bazada saqlandi`);
    return created;
  }

  pinDigest(pin: string): string {
    return pinDigest(this.pinSecret, pin);
  }

  /**
   * PIN bilan kirish. Nofaol xodimning PIN'i ham "noto'g'ri" deb javob oladi (qaysi PIN mavjudligi bilinmasin).
   * Tanlab topishdan himoya — IP bo'yicha urinishlar chegarasi (controller'da).
   */
  async login(pin: string): Promise<{ token: string; user: AuthUser }> {
    const user = await this.dataSource.manager.findOneBy(User, {
      pinDigest: this.pinDigest(pin),
      active: true,
    });
    if (!user) fail('wrong_pin');
    const payload: StaffTokenPayload = { typ: 'staff', sub: user.id };
    const token = await this.jwt.signAsync(payload, { secret: this.jwtSecret, expiresIn: STAFF_TOKEN_TTL });
    return { token, user: toAuthUser(user) };
  }

  /** Xodim tokeni → xodim. Bloklangan yoki o'chirilgan bo'lsa — `null` (eski token ishlamaydi). */
  async verifyStaff(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<StaffTokenPayload>(token, { secret: this.jwtSecret });
      if (payload.typ !== 'staff') return null;
      const user = await this.dataSource.manager.findOneBy(User, { id: payload.sub });
      return user && user.active ? toAuthUser(user) : null;
    } catch {
      return null;
    }
  }

  signCustomer(session: CustomerSession): Promise<string> {
    const payload: CustomerTokenPayload = {
      typ: 'customer',
      ...(session.customerId && { cid: session.customerId }),
      ...(session.telegramId !== null && { tg: session.telegramId }),
    };
    return this.jwt.signAsync(payload, { secret: this.jwtSecret, expiresIn: CUSTOMER_TOKEN_TTL });
  }

  async verifyCustomer(token: string): Promise<CustomerSession | null> {
    try {
      const payload = await this.jwt.verifyAsync<CustomerTokenPayload>(token, { secret: this.jwtSecret });
      if (payload.typ !== 'customer') return null;
      return {
        customerId: payload.cid ?? null,
        telegramId: typeof payload.tg === 'number' ? payload.tg : null,
      };
    } catch {
      return null;
    }
  }
}
