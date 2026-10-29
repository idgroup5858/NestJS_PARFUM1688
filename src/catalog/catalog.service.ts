import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { fail } from '../common/errors';
import { uniqueId } from '../common/ids';
import { transaction } from '../database/transaction';
import { stockKey } from '../stock/stock-key';
import { AccordDto, BannerDto, BrandDto, CategoryDto, FlakonDto, NoteDto, ProductDto } from './catalog.dto';
import { Accord, Banner, Brand, Category, Flakon, Note, Product } from './entities';

/** jsonb massivda shu id bormi (`'["a","b"]' @> '["a"]'`) — SQL parametri. */
const asJsonArray = (value: unknown) => JSON.stringify([value]);

async function count(em: EntityManager, sql: string, params: unknown[]): Promise<number> {
  const rows: { count: string }[] = await em.query(sql, params);
  return Number(rows[0]?.count ?? 0);
}

/**
 * Katalog: brend, kategoriya, nota, akkord, atir, flakon (tara), banner. Id lar nomdan (frontend `uniqueId`):
 * "Dior Sauvage" → "dior-sauvage". Atirlarda ishlatilayotgan yozuv o'chirilmaydi (`in_use`, `detail` — nechta atir).
 */
@Injectable()
export class CatalogService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get em() {
    return this.dataSource.manager;
  }

  /** Xodimlar uchun to'liq katalog (nofaol atir va flakonlar ham). */
  async all() {
    const em = this.em;
    const [brands, categories, notes, accords, products, flakons, banners] = await Promise.all([
      em.find(Brand, { order: { name: 'ASC' } }),
      em.find(Category, { order: { sort: 'ASC', id: 'ASC' } }),
      em.find(Note, { order: { id: 'ASC' } }),
      em.find(Accord, { order: { id: 'ASC' } }),
      em.find(Product, { order: { createdAt: 'DESC', name: 'ASC' } }),
      em.find(Flakon, { order: { volumeMl: 'ASC', name: 'ASC' } }),
      em.find(Banner, { order: { sort: 'ASC', id: 'ASC' } }),
    ]);
    return { brands, categories, notes, accords, products, flakons, banners };
  }

  // ───────────────────────── brendlar ─────────────────────────

  async saveBrand(id: string | null, dto: BrandDto): Promise<Brand> {
    return transaction(this.dataSource, async (em) => {
      const brands = await em.find(Brand);
      const lower = dto.name.toLowerCase();
      if (brands.some((brand) => brand.id !== id && brand.name.toLowerCase() === lower))
        fail('name_taken', dto.name);
      const data = { name: dto.name, country: dto.country ?? null };
      if (id) {
        await this.mustExist(em, Brand, id);
        await em.update(Brand, id, data);
        return em.findOneByOrFail(Brand, { id });
      }
      const brand: Brand = {
        id: uniqueId(
          dto.name,
          brands.map((item) => item.id),
          'br',
        ),
        ...data,
      };
      await em.insert(Brand, brand);
      return brand;
    });
  }

  async removeBrand(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await this.mustExist(em, Brand, id);
      const used = await em.count(Product, { where: { brandId: id } });
      if (used > 0) fail('in_use', `${used} products`);
      await em.delete(Brand, id);
    });
  }

  // ───────────────────────── kategoriyalar ─────────────────────────

  async saveCategory(id: string | null, dto: CategoryDto): Promise<Category> {
    if (!dto.name.ru || !dto.name.uz) fail('name_required');
    if (dto.group === 'family' && !dto.image) fail('image_required');
    return transaction(this.dataSource, async (em) => {
      const data = {
        name: { ru: dto.name.ru, uz: dto.name.uz },
        group: dto.group,
        image: dto.image,
        sort: dto.sort,
      };
      if (id) {
        const category = await this.mustExist(em, Category, id);
        // ishlatilayotgan oila sinfga aylansa, atirlar oilasiz qoladi (bosh sahifadan yo'qoladi)
        if (category.group !== dto.group) {
          const used = await this.categoryUsage(em, id);
          if (used > 0) fail('group_locked', `${used} products`);
        }
        await em.update(Category, id, data);
        return em.findOneByOrFail(Category, { id });
      }
      const ids = (await em.find(Category, { select: { id: true } })).map((item) => item.id);
      const category: Category = { id: uniqueId(dto.name.uz, ids, 'cat'), ...data };
      await em.insert(Category, category);
      return category;
    });
  }

  async removeCategory(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await this.mustExist(em, Category, id);
      const used = await this.categoryUsage(em, id);
      if (used > 0) fail('in_use', `${used} products`);
      await em.delete(Category, id);
    });
  }

  private categoryUsage(em: EntityManager, id: string): Promise<number> {
    return count(em, `SELECT count(*) FROM products WHERE "categoryIds" @> $1::jsonb`, [asJsonArray(id)]);
  }

  // ───────────────────────── notalar ─────────────────────────

  async saveNote(id: string | null, dto: NoteDto): Promise<Note> {
    if (!dto.name.ru || !dto.name.uz) fail('name_required');
    return transaction(this.dataSource, async (em) => {
      const data = { name: { ru: dto.name.ru, uz: dto.name.uz }, image: dto.image };
      if (id) {
        await this.mustExist(em, Note, id);
        await em.update(Note, id, data);
        return em.findOneByOrFail(Note, { id });
      }
      const ids = (await em.find(Note, { select: { id: true } })).map((item) => item.id);
      const note: Note = { id: uniqueId(dto.name.uz, ids, 'note'), ...data };
      await em.insert(Note, note);
      return note;
    });
  }

  async removeNote(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await this.mustExist(em, Note, id);
      const used = await count(
        em,
        `SELECT count(*) FROM products
         WHERE notes->'top' @> $1::jsonb OR notes->'middle' @> $1::jsonb OR notes->'base' @> $1::jsonb`,
        [asJsonArray(id)],
      );
      if (used > 0) fail('in_use', `${used} products`);
      await em.delete(Note, id);
    });
  }

  // ───────────────────────── akkordlar ─────────────────────────

  async saveAccord(id: string | null, dto: AccordDto): Promise<Accord> {
    if (!dto.name.ru || !dto.name.uz) fail('name_required');
    return transaction(this.dataSource, async (em) => {
      const data = { name: { ru: dto.name.ru, uz: dto.name.uz }, color: dto.color.toLowerCase() };
      if (id) {
        await this.mustExist(em, Accord, id);
        await em.update(Accord, id, data);
        return em.findOneByOrFail(Accord, { id });
      }
      const ids = (await em.find(Accord, { select: { id: true } })).map((item) => item.id);
      const accord: Accord = { id: uniqueId(dto.name.uz, ids, 'acc'), ...data };
      await em.insert(Accord, accord);
      return accord;
    });
  }

  async removeAccord(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await this.mustExist(em, Accord, id);
      const used = await count(em, `SELECT count(*) FROM products WHERE accords @> $1::jsonb`, [
        asJsonArray(id),
      ]);
      if (used > 0) fail('in_use', `${used} products`);
      await em.delete(Accord, id);
    });
  }

  // ───────────────────────── atirlar ─────────────────────────

  async saveProduct(id: string | null, dto: ProductDto): Promise<Product> {
    return transaction(this.dataSource, async (em) => {
      await this.validateProduct(em, id, dto);
      const unique = (ids: string[]) => [...new Set(ids)];
      const data = {
        name: dto.name,
        brandId: dto.brandId,
        categoryIds: unique(dto.categoryIds),
        gender: dto.gender,
        image: dto.image,
        description: { ru: dto.description.ru, uz: dto.description.uz },
        notes: { top: unique(dto.notes.top), middle: unique(dto.notes.middle), base: unique(dto.notes.base) },
        accords: unique(dto.accords),
        season: dto.season,
        longevity: dto.longevity,
        sillage: dto.sillage,
        pricePerGram: dto.pricePerGram,
        bottle: dto.bottle ? { volumeMl: dto.bottle.volumeMl, price: dto.bottle.price } : null,
        isNew: dto.isNew,
        active: dto.active,
      };
      if (id) {
        await this.mustExist(em, Product, id);
        await em.update(Product, id, data);
        return em.findOneByOrFail(Product, { id });
      }
      const ids = (await em.find(Product, { select: { id: true } })).map((item) => item.id);
      const product: Product = { id: uniqueId(dto.name, ids, 'prd'), ...data, createdAt: new Date() };
      await em.insert(Product, product);
      return product;
    });
  }

  private async validateProduct(em: EntityManager, id: string | null, dto: ProductDto): Promise<void> {
    if (!dto.name) fail('name_required');
    const sameName: { id: string }[] = await em.query(
      `SELECT id FROM products WHERE lower(trim(name)) = lower($1) AND ($2::varchar IS NULL OR id <> $2)`,
      [dto.name, id],
    );
    if (sameName.length) fail('name_taken', dto.name);
    if (!(await em.existsBy(Brand, { id: dto.brandId }))) fail('not_found', `brand ${dto.brandId}`);

    const categories = dto.categoryIds.length ? await em.findBy(Category, { id: In(dto.categoryIds) }) : [];
    const missingCategory = dto.categoryIds.find(
      (categoryId) => !categories.some((item) => item.id === categoryId),
    );
    if (missingCategory) fail('not_found', `category ${missingCategory}`);
    if (!categories.some((category) => category.group === 'family')) fail('family_required');

    const noteIds = [...new Set([...dto.notes.top, ...dto.notes.middle, ...dto.notes.base])];
    const notes = noteIds.length ? await em.findBy(Note, { id: In(noteIds) }) : [];
    const missingNote = noteIds.find((noteId) => !notes.some((item) => item.id === noteId));
    if (missingNote) fail('not_found', `note ${missingNote}`);

    const accords = dto.accords.length ? await em.findBy(Accord, { id: In(dto.accords) }) : [];
    const missingAccord = dto.accords.find((accordId) => !accords.some((item) => item.id === accordId));
    if (missingAccord) fail('not_found', `accord ${missingAccord}`);

    if (dto.pricePerGram <= 0) fail('invalid_price', 'pricePerGram');
    // mijoz ilovasi ikki tilli: bitta tilda yozilsa, ikkinchi tildagi «Описание» bo'sh chiqadi
    if (!dto.description.ru || !dto.description.uz) fail('description_required');
  }

  /**
   * Atir buyurtma, hujjat yoki ombor harakatida ishlatilgan bo'lsa o'chirilmaydi (tarix buziladi) — nofaol qilinadi.
   * Aks holda sharhlari va ombor qatorlari bilan o'chiriladi.
   */
  async removeProduct(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await this.mustExist(em, Product, id);
      const keys = [stockKey('gram', id), stockKey('bottle', id)];
      const keyLines = keys.map((key) => JSON.stringify([{ key }]));
      const used = await count(
        em,
        `SELECT
           (SELECT count(*) FROM orders WHERE lines @> $1::jsonb)
         + (SELECT count(*) FROM stock_movements WHERE "key" = ANY($2::varchar[]))
         + (SELECT count(*) FROM purchases WHERE lines @> $3::jsonb OR lines @> $4::jsonb)
         + (SELECT count(*) FROM inventories WHERE lines @> $3::jsonb OR lines @> $4::jsonb)
         + (SELECT count(*) FROM write_offs WHERE lines @> $3::jsonb OR lines @> $4::jsonb) AS count`,
        [JSON.stringify([{ productId: id }]), keys, keyLines[0], keyLines[1]],
      );
      if (used > 0) fail('in_use', 'orders or stock documents');
      await em.query(`DELETE FROM stock WHERE "key" = ANY($1::varchar[])`, [keys]);
      await em.delete(Product, id);
    });
  }

  async setProductActive(id: string, active: boolean): Promise<Product> {
    await this.mustExist(this.em, Product, id);
    await this.em.update(Product, id, { active });
    return this.em.findOneByOrFail(Product, { id });
  }

  // ───────────────────────── flakonlar (tara) ─────────────────────────

  async saveFlakon(id: string | null, dto: FlakonDto): Promise<Flakon> {
    return transaction(this.dataSource, async (em) => {
      const data = {
        name: dto.name,
        volumeMl: dto.volumeMl,
        price: dto.price,
        image: dto.image,
        active: dto.active,
      };
      if (id) {
        await this.mustExist(em, Flakon, id);
        await em.update(Flakon, id, data);
        return em.findOneByOrFail(Flakon, { id });
      }
      const ids = (await em.find(Flakon, { select: { id: true } })).map((item) => item.id);
      const flakon: Flakon = { id: uniqueId(`fl-${dto.name}`, ids, 'fl'), ...data };
      await em.insert(Flakon, flakon);
      return flakon;
    });
  }

  async removeFlakon(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      await this.mustExist(em, Flakon, id);
      const key = stockKey('flakon', id);
      const used = await count(
        em,
        `SELECT
           (SELECT count(*) FROM orders WHERE lines @> $1::jsonb)
         + (SELECT count(*) FROM stock_movements WHERE "key" = $2) AS count`,
        [JSON.stringify([{ flakon: { flakonId: id } }]), key],
      );
      if (used > 0) fail('in_use', 'orders or stock movements');
      await em.query(`DELETE FROM stock WHERE "key" = $1`, [key]);
      await em.delete(Flakon, id);
    });
  }

  async setFlakonActive(id: string, active: boolean): Promise<Flakon> {
    await this.mustExist(this.em, Flakon, id);
    await this.em.update(Flakon, id, { active });
    return this.em.findOneByOrFail(Flakon, { id });
  }

  // ───────────────────────── bannerlar ─────────────────────────

  async saveBanner(id: string | null, dto: BannerDto): Promise<Banner> {
    if (!dto.title.ru || !dto.title.uz) fail('name_required', 'title');
    return transaction(this.dataSource, async (em) => {
      const data = {
        title: { ru: dto.title.ru, uz: dto.title.uz },
        subtitle: { ru: dto.subtitle.ru, uz: dto.subtitle.uz },
        button: { ru: dto.button.ru, uz: dto.button.uz },
        link: dto.link,
        image: dto.image,
        active: dto.active,
        sort: dto.sort,
      };
      if (id) {
        await this.mustExist(em, Banner, id);
        await em.update(Banner, id, data);
        return em.findOneByOrFail(Banner, { id });
      }
      const ids = (await em.find(Banner, { select: { id: true } })).map((item) => item.id);
      const banner: Banner = { id: uniqueId(`bn-${dto.title.uz}`, ids, 'bn'), ...data };
      await em.insert(Banner, banner);
      return banner;
    });
  }

  async removeBanner(id: string): Promise<void> {
    await this.mustExist(this.em, Banner, id);
    await this.em.delete(Banner, id);
  }

  async setBannerActive(id: string, active: boolean): Promise<Banner> {
    await this.mustExist(this.em, Banner, id);
    await this.em.update(Banner, id, { active });
    return this.em.findOneByOrFail(Banner, { id });
  }

  // ───────────────────────── umumiy ─────────────────────────

  private async mustExist<T extends { id: string }>(
    em: EntityManager,
    entity: new () => T,
    id: string,
  ): Promise<T> {
    const found = await em.findOne(entity, { where: { id } as never });
    return found ?? fail('not_found', `${entity.name} ${id}`);
  }
}
