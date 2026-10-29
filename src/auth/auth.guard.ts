import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fail } from '../common/errors';
import type { Role } from '../common/types';
import { AuthService } from './auth.service';
import type { AuthedRequest } from './auth.types';
import { CUSTOMER, IS_PUBLIC, ROLES } from './decorators';

function bearer(request: AuthedRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/**
 * Global guard: standart bo'yicha — xodim tokeni (`Authorization: Bearer <token>`, PIN bilan kirgandan keyin),
 * `@Roles()` bo'lsa — rol ham. `@CustomerAuth()` — mijoz ilovasi tokeni. `@Public()` — tokensiz.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const meta = <T>(key: string) =>
      this.reflector.getAllAndOverride<T>(key, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();

    const customer = meta<{ optional: boolean }>(CUSTOMER);
    if (customer) {
      const token = bearer(request);
      const session = token ? await this.auth.verifyCustomer(token) : null;
      // token berilgan, lekin yaroqsiz — tokensiz deb o'tkazilmaydi (mijoz ilovasi yangi sessiya olsin)
      if (!session && (token || !customer.optional)) fail('unauthorized');
      request.customer = session;
      return true;
    }

    if (meta<boolean>(IS_PUBLIC)) return true;

    const token = bearer(request);
    const user = (token && (await this.auth.verifyStaff(token))) || fail('unauthorized');
    const roles = meta<Role[]>(ROLES);
    if (roles && !roles.includes(user.role)) fail('forbidden', user.role);
    request.user = user;
    return true;
  }
}
