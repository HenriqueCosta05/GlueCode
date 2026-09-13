import { Module } from '@nestjs/common';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { QueueModule } from '@/infrastructure/queue/queue.module';
import { ExecutionsController } from './executions.controller';

@Module({
  imports: [ExecutionModule, QueueModule],
  controllers: [ExecutionsController],
})
export class ExecutionsModule {}
