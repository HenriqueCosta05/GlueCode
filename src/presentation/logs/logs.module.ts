import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { DomainExceptionFilter } from '@/presentation/common/domain-exception.filter';
import { LogsController } from './logs.controller';

@Module({
  imports: [LogEntryModule],
  controllers: [LogsController],
  providers: [
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class LogsModule {}
