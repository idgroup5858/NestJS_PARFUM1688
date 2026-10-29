import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthUser } from '../auth/auth.types';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { UsersService } from './users.service';

/** Admin → Xodimlar. Xodimlar ro'yxati (ism va rol) kassaga ham kerak — `GET` har qanday xodimga ochiq. */
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.users.create(dto);
    this.realtime.changed('users');
    return user;
  }

  @Roles('admin')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.users.update(id, dto, actor);
    this.realtime.changed('users');
    return user;
  }

  @Roles('admin')
  @HttpCode(204)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    await this.users.remove(id, actor);
    this.realtime.changed('users');
  }
}
