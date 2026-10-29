import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { bigintNumber, ID_LENGTH } from '../common/columns';
import type { WriteOffReason } from '../common/types';
import type { StockKey } from '../stock/stock-key';

@Entity('suppliers')
export class Supplier {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 20, default: '' })
  phone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

export interface PurchaseLine {
  key: StockKey;
  qty: number;
  /** 1 birlik kirim narxi */
  unitCost: number;
}

/** Prixod (kirim): yetkazib beruvchidan tovar. To'lanmagan qismi qarzga yoziladi. */
@Entity('purchases')
export class Purchase {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'int' })
  number: number;

  /** "YYYY-MM-DD" */
  @Index()
  @Column({ length: 10 })
  date: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

  @Column({ type: 'jsonb' })
  lines: PurchaseLine[];

  @Column({ type: 'bigint', transformer: bigintNumber })
  total: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

/** Yetkazib beruvchiga to'lov. Qarz = Σ prixod − Σ to'lov (prixod paytidagi to'lov ham shu yerda, purchaseId bilan). */
@Entity('supplier_payments')
export class SupplierPayment {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ length: 10 })
  date: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  supplierId: string;

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

  @Column({ type: 'bigint', transformer: bigintNumber })
  amount: number;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  purchaseId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

export interface InventoryLine {
  key: StockKey;
  /** tizimdagi qoldiq (sanoq saqlangan paytda) */
  expected: number;
  actual: number;
  unitCost: number;
}

/** Inventarizatsiya: sanalgan qoldiq bilan tizimdagi farq harakat sifatida yoziladi. */
@Entity('inventories')
export class InventoryCount {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'int' })
  number: number;

  @Index()
  @Column({ length: 10 })
  date: string;

  @Column({ type: 'jsonb' })
  lines: InventoryLine[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

export interface WriteOffLine {
  key: StockKey;
  qty: number;
  unitCost: number;
}

/** Spisanie: to'kilgan, singan, tester va h.k. */
@Entity('write_offs')
export class WriteOff {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'int' })
  number: number;

  @Index()
  @Column({ length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 10 })
  reason: WriteOffReason;

  @Column({ type: 'jsonb' })
  lines: WriteOffLine[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
