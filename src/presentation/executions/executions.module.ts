import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { DomainExceptionFilter } from '@/presentation/common/domain-exception.filter';
import { ExecutionsController } from './executions.controller';

@Module({
  imports: [ExecutionModule, QueueModule],
  controllers: [ExecutionsController],
  providers: [
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class ExecutionsModule {}
