import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { DomainExceptionFilter } from '@/presentation/common/domain-exception.filter';
import { ExecutionsController } from './executions.controller';

@Module({
  imports: [ExecutionModule, QueueModule],
  controllers: [ExecutionsController],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class ExecutionsModule {}
