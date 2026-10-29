import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { isDateKey, todayKey } from '../common/dates';
import { fail } from '../common/errors';
import { newId } from '../common/ids';
import { transaction } from '../database/transaction';
import { Expense, ExpenseCategory } from './expense.entities';
import { ExpenseCategoryDto, ExpenseDto, ExpensesQuery } from './expenses.dto';

@Injectable()
export class ExpensesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private get em() {
    return this.dataSource.manager;
  }

  // ── kategoriyalar ──

  categories() {
    return this.em.find(ExpenseCategory, { order: { name: 'ASC' } });
  }

  async createCategory(dto: ExpenseCategoryDto): Promise<ExpenseCategory> {
    const category: ExpenseCategory = { id: newId('exc'), name: dto.name };
    await this.em.insert(ExpenseCategory, category);
    return category;
  }

  async renameCategory(id: string, dto: ExpenseCategoryDto): Promise<ExpenseCategory> {
    if (!(await this.em.existsBy(ExpenseCategory, { id }))) fail('not_found', `expense category ${id}`);
    await this.em.update(ExpenseCategory, id, { name: dto.name });
    return this.em.findOneByOrFail(ExpenseCategory, { id });
  }

  /** Faqat ishlatilmagan kategoriya o'chiriladi. */
  async removeCategory(id: string): Promise<void> {
    await transaction(this.dataSource, async (em) => {
      if (!(await em.existsBy(ExpenseCategory, { id }))) fail('not_found', `expense category ${id}`);
      const used = await em.count(Expense, { where: { categoryId: id } });
      if (used > 0) fail('in_use', `${used} expenses`);
      await em.delete(ExpenseCategory, id);
    });
  }

  // ── chiqimlar ──

  list(query: ExpensesQuery) {
    const date =
      query.from && query.to
        ? Between(query.from, query.to)
        : query.from
          ? MoreThanOrEqual(query.from)
          : query.to
            ? LessThanOrEqual(query.to)
            : undefined;
    return this.em.find(Expense, { where: date ? { date } : {}, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async save(id: string | null, dto: ExpenseDto, userId: string): Promise<Expense> {
    if (!isDateKey(dto.date)) fail('invalid_input', `date ${dto.date}`);
    if (dto.date > todayKey()) fail('future_date', dto.date);
    if (!(await this.em.existsBy(ExpenseCategory, { id: dto.categoryId }))) {
      fail('not_found', `expense category ${dto.categoryId}`);
    }
    const data = {
      date: dto.date,
      categoryId: dto.categoryId,
      amount: dto.amount,
      payment: dto.payment,
      note: dto.note ?? null,
    };
    if (id) {
      if (!(await this.em.existsBy(Expense, { id }))) fail('not_found', `expense ${id}`);
      await this.em.update(Expense, id, data);
      return this.em.findOneByOrFail(Expense, { id });
    }
    const expense: Expense = { id: newId('ex'), ...data, userId, createdAt: new Date() };
    await this.em.insert(Expense, expense);
    return expense;
  }

  async remove(id: string): Promise<void> {
    const result = await this.em.delete(Expense, id);
    if (!result.affected) fail('not_found', `expense ${id}`);
  }
}
