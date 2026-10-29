import { Global, Module } from '@nestjs/common';
import { BroadcastsService } from './broadcasts.service';
import { TelegramNotifier } from './notifier.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Global()
@Module({
  controllers: [TelegramController],
  providers: [TelegramService, TelegramNotifier, BroadcastsService],
  exports: [TelegramService, TelegramNotifier],
})
export class TelegramModule {}
