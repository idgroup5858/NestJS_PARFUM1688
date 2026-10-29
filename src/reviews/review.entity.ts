import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Product } from '../catalog/entities';
import { ID_LENGTH } from '../common/columns';

/** Sharh: shu atirni xarid qilgan ("Berildi") mijoz yozadi, bitta atirga bitta sharh. */
@Entity('reviews')
@Index(['customerId', 'productId'], { unique: true })
export class Review {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product?: Product;

  @Column({ type: 'varchar', length: ID_LENGTH })
  customerId: string;

  /** ko'rsatiladigan ism (ismining birinchi so'zi) */
  @Column({ length: 60 })
  name: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ length: 1000 })
  text: string;

  @Column({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ default: false })
  hidden: boolean;
}
