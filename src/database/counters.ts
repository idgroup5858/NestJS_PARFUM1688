import { Column, Entity, EntityManager, PrimaryColumn } from 'typeorm';

export type CounterKey = 'order' | 'purchase' | 'inventory' | 'writeOff';

/** Ketma-ket hujjat raqamlari: buyurtma (#1001...), prixod (PR-0001), inventarizatsiya (INV-0001), spisanie (SPS-0001). */
@Entity('counters')
export class Counter {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  key: string;

  @Column({ type: 'int' })
  value: number;
}

/** Buyurtma raqamlari 1001 dan boshlanadi (frontend demo bilan bir xil). */
export const COUNTER_START: Record<CounterKey, number> = {
  order: 1000,
  purchase: 0,
  inventory: 0,
  writeOff: 0,
};

/**
 * Hisoblagichning keyingi qiymati. Bitta SQL — qator tranzaksiya oxirigacha qulflanadi, bir vaqtda kelgan ikki buyurtma
 * bir xil raqam olmaydi; tranzaksiya bekor bo'lsa raqam ham qaytadi.
 */
export async function nextCounter(em: EntityManager, key: CounterKey): Promise<number> {
  const rows: { value: number }[] = await em.query(
    `INSERT INTO counters ("key", "value") VALUES ($1, $2)
     ON CONFLICT ("key") DO UPDATE SET "value" = counters."value" + 1
     RETURNING "value"`,
    [key, COUNTER_START[key] + 1],
  );
  return rows[0].value;
}
