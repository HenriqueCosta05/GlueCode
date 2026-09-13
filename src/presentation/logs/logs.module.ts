import { Module } from '@nestjs/common';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { LogsController } from './logs.controller';

@Module({
  imports: [LogEntryModule],
  controllers: [LogsController],
})
export class LogsModule {}
