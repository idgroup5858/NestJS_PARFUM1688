import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ExpenseCategoryDto, ExpenseDto, ExpensesQuery } from './expenses.dto';
import { ExpensesService } from './expenses.service';

/** Admin → Chiqimlar va ularning kategoriyalari. */
@Roles('admin')
@Controller()
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async notify<T>(work: Promise<T>): Promise<T> {
    const result = await work;
    this.realtime.changed('expenses');
    return result;
  }

  @Get('expense-categories')
  categories() {
    return this.expenses.categories();
  }

  @Post('expense-categories')
  createCategory(@Body() dto: ExpenseCategoryDto) {
    return this.notify(this.expenses.createCategory(dto));
  }

  @Put('expense-categories/:id')
  renameCategory(@Param('id') id: string, @Body() dto: ExpenseCategoryDto) {
    return this.notify(this.expenses.renameCategory(id, dto));
  }

  @HttpCode(204)
  @Delete('expense-categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.notify(this.expenses.removeCategory(id));
  }

  @Get('expenses')
  list(@Query() query: ExpensesQuery) {
    return this.expenses.list(query);
  }

  @Post('expenses')
  create(@Body() dto: ExpenseDto, @CurrentUser() user: AuthUser) {
    return this.notify(this.expenses.save(null, dto, user.id));
  }

  @Put('expenses/:id')
  update(@Param('id') id: string, @Body() dto: ExpenseDto, @CurrentUser() user: AuthUser) {
    return this.notify(this.expenses.save(id, dto, user.id));
  }

  @HttpCode(204)
  @Delete('expenses/:id')
  remove(@Param('id') id: string) {
    return this.notify(this.expenses.remove(id));
  }
}
