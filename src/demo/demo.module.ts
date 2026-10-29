import { Module } from '@nestjs/common';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [WarehouseModule],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
