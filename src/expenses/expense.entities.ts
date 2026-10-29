import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { bigintNumber, ID_LENGTH } from '../common/columns';
import type { PaymentType } from '../common/types';

@Entity('expense_categories')
export class ExpenseCategory {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ length: 100 })
  name: string;
}

@Entity('expenses')
export class Expense {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  /** "YYYY-MM-DD" */
  @Index()
  @Column({ length: 10 })
  date: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  categoryId: string;

  @ManyToOne(() => ExpenseCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category?: ExpenseCategory;

  @Column({ type: 'bigint', transformer: bigintNumber })
  amount: number;

  @Column({ type: 'varchar', length: 10 })
  payment: PaymentType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
