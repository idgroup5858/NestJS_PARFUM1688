import { DataSource, EntityManager, QueryFailedError } from 'typeorm';

/** Postgres: deadlock_detected va serialization_failure — tranzaksiyani qaytadan bajarish xavfsiz. */
const RETRYABLE = new Set(['40P01', '40001']);

/**
 * Tranzaksiya; ikki tranzaksiya bir-birini kutib qolsa (masalan, prixod tannarxi buyurtmaga yozilayotganda kassir shu
 * buyurtmani yopsa) Postgres bittasini bekor qiladi — u 3 martagacha qaytadan bajariladi. [work] faqat bazaga yozsin
 * (xabar yuborish, socket — tranzaksiyadan keyin).
 */
export async function transaction<T>(
  dataSource: DataSource,
  work: (em: EntityManager) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await dataSource.transaction(work);
    } catch (error) {
      const code =
        error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined;
      if (!code || !RETRYABLE.has(code) || attempt >= 3) throw error;
    }
  }
}
