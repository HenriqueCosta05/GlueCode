import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { DomainExceptionFilter } from '@/presentation/common/domain-exception.filter';
import { LogsController } from './logs.controller';

@Module({
  imports: [LogEntryModule],
  controllers: [LogsController],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class LogsModule {}
