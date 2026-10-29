import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { ID_LENGTH } from '../common/columns';
import type { Fulfillment, OrderSource, OrderStatus, PaymentType } from '../common/types';

export interface OrderLineFlakon {
  flakonId: string;
  paid: boolean;
  price: number;
  /** ombordan chiqarilgandagi tara tannarxi */
  unitCost?: number;
}

export interface OrderLine {
  id: string;
  productId: string;
  /** gram — razliv (qty grammda), bottle — original flakon (qty donada) */
  kind: 'gram' | 'bottle';
  /** buyurtma paytidagi nom */
  name: string;
  /** faqat original qatorida: buyurtma paytidagi flakon hajmi, ml */
  volumeMl?: number;
  qty: number;
  /** 1 gramm yoki 1 dona narxi */
  unitPrice: number;
  /** ombordan chiqarilgandagi tannarx (1 birlik) — foyda hisobi uchun */
  unitCost?: number;
  /** faqat razliv qatorida: kassir tanlagan tara */
  flakon?: OrderLineFlakon;
}

export interface OrderEvent {
  status: OrderStatus;
  at: string;
  userId?: string;
}

export interface OrderSlot {
  date: string;
  hour: number;
}

@Entity('orders')
@Index(['status', 'createdAt'])
export class Order {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'varchar', length: 4 })
  source: OrderSource;

  @Index()
  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  customerId: string | null;

  @Column({ length: 100, default: '' })
  customerName: string;

  @Column({ length: 20, default: '' })
  customerPhone: string;

  @Column({ type: 'varchar', length: 10 })
  fulfillment: Fulfillment;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  /** bot buyurtmasi: mijoz tanlagan kun va soat */
  @Column({ type: 'jsonb', nullable: true })
  slot: OrderSlot | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  comment: string | null;

  @Column({ type: 'jsonb' })
  lines: OrderLine[];

  /** yetkazish narxi — kassir mijoz bilan telefonda kelishib kiritadi */
  @Column({ type: 'int', default: 0 })
  deliveryFee: number;

  @Column({ type: 'varchar', length: 10 })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 10, nullable: true })
  payment: PaymentType | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  cashierId: string | null;

  @Column({ type: 'jsonb' })
  history: OrderEvent[];

  /** atir va taralar ombordan chiqarilganmi ("Tayyor" bosilganda) */
  @Column({ default: false })
  stockApplied: boolean;
}
