import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/auth.types';
import { fail } from '../common/errors';
import { newId } from '../common/ids';
import { transaction } from '../database/transaction';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auth: AuthService,
  ) {}

  /** Faollari birinchi, keyin rol va ism bo'yicha. PIN qaytarilmaydi. */
  async list(): Promise<User[]> {
    const users = await this.dataSource.manager.find(User);
    return users.sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name),
    );
  }

  async create(dto: CreateUserDto): Promise<User> {
    return transaction(this.dataSource, async (em) => {
      const pinDigest = this.auth.pinDigest(dto.pin);
      await this.ensurePinFree(em, pinDigest);
      const user: User = {
        id: newId('u'),
        name: dto.name,
        role: dto.role,
        pinDigest,
        active: dto.active ?? true,
        createdAt: new Date(),
      };
      await em.insert(User, user);
      return this.get(em, user.id);
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser): Promise<User> {
    return transaction(this.dataSource, async (em) => {
      // admin o'zgarishlari ketma-ket — "kamida bitta admin" tekshiruvi bir vaqtdagi ikki so'rovda ham to'g'ri
      await em.query(`SELECT id FROM users ORDER BY id FOR UPDATE`);
      const user = await this.get(em, id);
      const self = user.id === actor.id;
      if (self && dto.active === false) fail('self_action', 'deactivate self');
      // kassir roli bilan admin paneldan darhol chiqarib yuborilardi — rolni boshqa admin o'zgartiradi
      if (self && dto.role && dto.role !== 'admin') fail('self_action', 'demote self');
      const next = { role: dto.role ?? user.role, active: dto.active ?? user.active };
      if (!(await this.leavesAdmin(em, user.id, next))) fail('last_admin');

      const patch: Partial<User> = {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.active !== undefined && { active: dto.active }),
      };
      if (dto.pin !== undefined) {
        patch.pinDigest = this.auth.pinDigest(dto.pin);
        await this.ensurePinFree(em, patch.pinDigest, user.id);
      }
      if (Object.keys(patch).length) await em.update(User, user.id, patch);
      return this.get(em, user.id);
    });
  }

  async remove(id: string, actor: AuthUser): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await em.query(`SELECT id FROM users ORDER BY id FOR UPDATE`);
      const user = await this.get(em, id);
      if (user.id === actor.id) fail('self_action', 'delete self');
      if (!(await this.leavesAdmin(em, user.id, null))) fail('last_admin');
      // hujjatlarda muallif "—" bo'lib qolmasin — bunday xodim faqat nofaol qilinadi
      if (await this.hasHistory(em, user.id)) fail('user_has_history');
      await em.delete(User, user.id);
    });
  }

  private async get(em: EntityManager, id: string): Promise<User> {
    return (await em.findOneBy(User, { id })) ?? fail('not_found', `user ${id}`);
  }

  private async ensurePinFree(em: EntityManager, pinDigest: string, exceptId?: string): Promise<void> {
    const taken = await em.findOne(User, {
      where: { pinDigest, ...(exceptId && { id: Not(exceptId) }) },
      select: { id: true },
    });
    if (taken) fail('pin_taken');
  }

  /** O'zgarishdan keyin kamida bitta faol admin qoladimi ([next] = null — o'chiriladi). */
  private async leavesAdmin(
    em: EntityManager,
    userId: string,
    next: { role: User['role']; active: boolean } | null,
  ): Promise<boolean> {
    if (next?.active && next.role === 'admin') return true;
    const others = await em.count(User, { where: { id: Not(userId), role: 'admin', active: true } });
    return others > 0;
  }

  /** Xodim biror hujjatda yoki ombor harakatida muallif sifatida yozilganmi. */
  private async hasHistory(em: EntityManager, userId: string): Promise<boolean> {
    const rows: unknown[] = await em.query(
      `SELECT 1 WHERE
         EXISTS (SELECT 1 FROM orders WHERE "cashierId" = $1 OR history @> $2::jsonb)
         OR EXISTS (SELECT 1 FROM purchases WHERE "userId" = $1)
         OR EXISTS (SELECT 1 FROM supplier_payments WHERE "userId" = $1)
         OR EXISTS (SELECT 1 FROM inventories WHERE "userId" = $1)
         OR EXISTS (SELECT 1 FROM write_offs WHERE "userId" = $1)
         OR EXISTS (SELECT 1 FROM expenses WHERE "userId" = $1)
         OR EXISTS (SELECT 1 FROM stock_movements WHERE "userId" = $1)`,
      [userId, JSON.stringify([{ userId }])],
    );
    return rows.length > 0;
  }
}
