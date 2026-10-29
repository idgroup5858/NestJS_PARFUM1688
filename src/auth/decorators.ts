import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { fail } from '../common/errors';
import type { Role } from '../common/types';
import type { AuthedRequest, AuthUser, CustomerSession } from './auth.types';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const CUSTOMER = 'customer';

/** Tokensiz ochiq endpoint (kirish, mijoz katalogi). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Faqat shu rollardagi xodim. Berilmasa — istalgan kirgan xodim. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/**
 * Mijoz ilovasi endpointi: `Authorization: Bearer <mijoz tokeni>`. [optional] — tokensiz ham ochiq (masalan, birinchi
 * buyurtma), token bo'lsa — tekshiriladi.
 */
export const CustomerAuth = (options: { optional?: boolean } = {}) =>
  SetMetadata(CUSTOMER, { optional: options.optional ?? false });

/** Kirgan xodim (guard qo'ygan). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const user = context.switchToHttp().getRequest<AuthedRequest>().user;
  return user ?? fail('unauthorized');
});

/** Mijoz sessiyasi (`@CustomerAuth({ optional: true })` da — `null` bo'lishi mumkin). */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CustomerSession | null =>
    context.switchToHttp().getRequest<AuthedRequest>().customer ?? null,
);
