import { ValueTransformer } from 'typeorm';

/** Postgres `bigint` matn bo'lib qaytadi — pul summalari va Telegram id lari JS'da son sifatida ishlatiladi. */
export const bigintNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** Id ustunlari: katalog slug'lari (`maison-francis-kurkdjian-baccarat-rouge-540`) va hujjat id lari sig'adi. */
export const ID_LENGTH = 80;

/** Ombor pozitsiyasi kaliti: `gram:<atir id>`, `bottle:<atir id>`, `flakon:<flakon id>`. */
export const STOCK_KEY_LENGTH = 100;

/** Rasm yo'li `images` papkasi ichida: "perfumes/dior-sauvage.png". */
export const IMAGE_LENGTH = 200;
