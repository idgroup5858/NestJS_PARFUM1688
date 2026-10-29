import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { appError } from '../common/errors';

/**
 * IP bo'yicha urinishlar chegarasi (PIN bilan kirish, mijoz buyurtmasi). Kirish faqat PIN bilan — bitta xodimni
 * bloklab bo'lmaydi, shuning uchun himoya shu chegarada. Javob bizning xato ko'rinishida: `too_many_attempts`.
 */
@Injectable()
export class AttemptsGuard extends ThrottlerGuard {
  protected async throwThrottlingException(): Promise<void> {
    throw appError('too_many_attempts');
  }
}
