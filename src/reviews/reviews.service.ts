import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { Product } from '../catalog/entities';
import { fail } from '../common/errors';
import { newId } from '../common/ids';
import { Customer } from '../customers/customer.entity';
import { Review } from './review.entity';

@Injectable()
export class ReviewsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get em() {
    return this.dataSource.manager;
  }

  /** Admin: hammasi (yashirilganlari ham), eng yangisi birinchi. */
  all() {
    return this.em.find(Review, { order: { createdAt: 'DESC' } });
  }

  async setHidden(id: string, hidden: boolean): Promise<Review> {
    if (!(await this.em.existsBy(Review, { id }))) fail('not_found', `review ${id}`);
    await this.em.update(Review, id, { hidden });
    return this.em.findOneByOrFail(Review, { id });
  }

  async remove(id: string): Promise<void> {
    const result = await this.em.delete(Review, id);
    if (!result.affected) fail('not_found', `review ${id}`);
  }

  /** Mijoz ilovasi: atirning ko'rinadigan sharhlari (eng yangisi birinchi). */
  visible(productId: string) {
    return this.em.find(Review, {
      where: { productId, hidden: false },
      order: { createdAt: 'DESC' },
      select: { id: true, productId: true, name: true, rating: true, text: true, createdAt: true },
    });
  }

  /** Sharh yozish mumkinmi: shu atir bo'lgan buyurtmasi "Berildi" bo'lgan va hali sharh yozmagan mijoz. */
  async eligibility(
    customerId: string | null,
    productId: string,
  ): Promise<{ bought: boolean; reviewed: boolean }> {
    if (!customerId) return { bought: false, reviewed: false };
    const rows: { bought: boolean; reviewed: boolean }[] = await this.em.query(
      `SELECT
         EXISTS (SELECT 1 FROM orders WHERE "customerId" = $1 AND status = 'done' AND lines @> $3::jsonb) AS bought,
         EXISTS (SELECT 1 FROM reviews WHERE "customerId" = $1 AND "productId" = $2) AS reviewed`,
      [customerId, productId, JSON.stringify([{ productId }])],
    );
    return rows[0];
  }

  async create(customerId: string, productId: string, rating: number, text: string): Promise<Review> {
    if (!(await this.em.existsBy(Product, { id: productId }))) fail('not_found', `product ${productId}`);
    const { bought, reviewed } = await this.eligibility(customerId, productId);
    if (!bought) fail('review_not_allowed');
    if (reviewed) fail('already_reviewed');
    const customer = await this.em.findOneBy(Customer, { id: customerId });
    const review: Review = {
      id: newId('rv'),
      productId,
      customerId,
      // ko'rsatiladigan ism — ismining birinchi so'zi
      name: (customer?.name.trim().split(/\s+/)[0] || 'Гость').slice(0, 60),
      rating,
      text,
      createdAt: new Date(),
      hidden: false,
    };
    try {
      await this.em.insert(Review, review);
    } catch (error) {
      // bir vaqtda ikki marta yuborilgan — unique (customerId, productId)
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505')
        fail('already_reviewed');
      throw error;
    }
    return review;
  }
}
