import { Module } from '@nestjs/common';
import { SnapshotController } from './snapshot.controller';

@Module({
  controllers: [SnapshotController],
})
export class SnapshotModule {}
