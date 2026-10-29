import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Kalit → qiymat (JSON): `shop` (do'kon sozlamalari), `telegram` (bot sozlamalari va holati), `jwtSecret`, `pinSecret`
 * (`.env` da berilmagan bo'lsa).
 */
@Entity('settings')
export class Setting {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;
}
