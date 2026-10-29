import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ID_LENGTH, STOCK_KEY_LENGTH } from '../common/columns';
import type { MovementReason } from '../common/types';
import type { StockKey } from './stock-key';

/** Ombor qoldig'i: har pozitsiya bitta qator. Qoldiq manfiy bo'lishi mumkin (savdo to'xtamaydi). */
@Entity('stock')
export class StockBalance {
  @PrimaryColumn({ type: 'varchar', length: STOCK_KEY_LENGTH })
  key: StockKey;

  /** gramm (razliv) yoki dona (original flakon, tara) */
  @Column({ type: 'int', default: 0 })
  qty: number;

  /** o'rtacha tannarx, 1 birlik uchun — kirimda qayta hisoblanadi */
  @Column({ type: 'int', default: 0 })
  avgCost: number;
}

@Entity('stock_movements')
@Index(['key', 'at'])
export class StockMovement {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'timestamptz' })
  at: Date;

  @Column({ type: 'varchar', length: STOCK_KEY_LENGTH })
  key: StockKey;

  /** + kirim, − chiqim */
  @Column({ type: 'int' })
  qty: number;

  @Column({ type: 'int' })
  unitCost: number;

  @Column({ type: 'varchar', length: 12 })
  reason: MovementReason;

  /** buyurtma / prixod / spisanie / inventarizatsiya id si */
  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  refId: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  userId: string | null;

  /**
   * chiqim paytida tannarx noma'lum edi (pozitsiya hali kirim qilinmagan) — keyingi prixod narxi shu harakatga va
   * hujjatiga yoziladi
   */
  @Column({ default: false })
  costPending: boolean;
}
