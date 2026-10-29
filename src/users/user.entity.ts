import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ID_LENGTH } from '../common/columns';
import type { Role } from '../common/types';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  role: Role;

  /**
   * PIN o'zi saqlanmaydi — HMAC-SHA256 (kalit `PIN_SECRET`). Kirish faqat PIN bilan (xodim tanlanmaydi), shuning uchun
   * xesh deterministik: PIN bo'yicha qidiriladi va takrorlanmasligi indeks bilan kafolatlanadi. Oddiy so'rovlarda
   * yuklanmaydi (`select: false`).
   */
  @Index({ unique: true })
  @Column({ length: 64, select: false })
  pinDigest: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
