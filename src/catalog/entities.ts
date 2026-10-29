import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ID_LENGTH, IMAGE_LENGTH } from '../common/columns';
import type {
  CategoryGroup,
  Gender,
  Localized,
  LongevityLevel,
  SeasonPreset,
  SillageLevel,
} from '../common/types';

@Entity('brands')
export class Brand {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  country: string | null;
}

/**
 * `family` — aromat oilasi (bosh sahifadagi rasmli kategoriyalar), `class` — sifat sinfi (PREMIUM, TOP...; atir nomi
 * yonida ko'rsatiladi).
 */
@Entity('categories')
export class Category {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'jsonb' })
  name: Localized;

  @Column({ length: IMAGE_LENGTH, default: '' })
  image: string;

  @Column({ type: 'varchar', length: 10 })
  group: CategoryGroup;

  @Column({ type: 'int', default: 0 })
  sort: number;
}

/** Nota (Bergamot, Atirgul...) — rasmi bilan bir marta kiritiladi, atirlarda ro'yxatdan tanlanadi. */
@Entity('notes')
export class Note {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'jsonb' })
  name: Localized;

  @Column({ length: IMAGE_LENGTH, default: '' })
  image: string;
}

/** Asosiy akkord — mahsulot sahifasidagi rangli chiziq. */
@Entity('accords')
export class Accord {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'jsonb' })
  name: Localized;

  /** chiziq foni "#f6e05e" */
  @Column({ length: 20 })
  color: string;
}

export interface ProductNotes {
  top: string[];
  middle: string[];
  base: string[];
}

export interface ProductBottle {
  volumeMl: number;
  price: number;
}

@Entity('products')
export class Product {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  /** "Louis Vuitton Symphony" — ikkala tilda bir xil */
  @Column({ length: 150 })
  name: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  brandId: string;

  @ManyToOne(() => Brand, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brandId' })
  brand?: Brand;

  /** family va class kategoriyalari aralash */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  categoryIds: string[];

  @Column({ type: 'varchar', length: 10 })
  gender: Gender;

  @Column({ length: IMAGE_LENGTH, default: '' })
  image: string;

  @Column({ type: 'jsonb' })
  description: Localized;

  @Column({ type: 'jsonb' })
  notes: ProductNotes;

  /** kuchlisidan boshlab tartiblangan akkordlar */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  accords: string[];

  @Column({ type: 'varchar', length: 12 })
  season: SeasonPreset;

  @Column({ type: 'varchar', length: 12 })
  longevity: LongevityLevel;

  @Column({ type: 'varchar', length: 12 })
  sillage: SillageLevel;

  /** quyib sotish (razliv) narxi, 1 gramm uchun */
  @Column({ type: 'int' })
  pricePerGram: number;

  /** original flakon (dona) sotiladimi; `null` — faqat razliv */
  @Column({ type: 'jsonb', nullable: true })
  bottle: ProductBottle | null;

  @Column({ default: false })
  isNew: boolean;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

/** Bo'sh idish (tara): quyilgan atir shunga solinadi. Kassir tanlaydi, tekin yoki pullik. */
@Entity('flakons')
export class Flakon {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'int' })
  volumeMl: number;

  /** pullik berilganda sotuv narxi */
  @Column({ type: 'int' })
  price: number;

  @Column({ length: IMAGE_LENGTH, default: '' })
  image: string;

  @Column({ default: true })
  active: boolean;
}

@Entity('banners')
export class Banner {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'jsonb' })
  title: Localized;

  @Column({ type: 'jsonb' })
  subtitle: Localized;

  @Column({ type: 'jsonb' })
  button: Localized;

  /** tugma bosilganda: "/catalog?filter=new", "/product/<id>" ... */
  @Column({ length: 300, default: '' })
  link: string;

  @Column({ length: IMAGE_LENGTH, default: '' })
  image: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sort: number;
}
