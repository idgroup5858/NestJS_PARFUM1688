import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { bigintNumber, ID_LENGTH } from '../common/columns';

@Entity('customers')
export class Customer {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ length: 100, default: '' })
  name: string;

  /** faqat raqamlar: "998901234567" (bir raqam bir nechta mijozda bo'lishi mumkin — qarindoshi uchun buyurtma) */
  @Index()
  @Column({ length: 20, default: '' })
  phone: string;

  /** Telegram foydalanuvchisi — bitta Telegram akkaunt bitta mijozga bog'lanadi */
  @Index({ unique: true, where: '"telegramId" IS NOT NULL' })
  @Column({ type: 'bigint', nullable: true, transformer: bigintNumber })
  telegramId: number | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}
