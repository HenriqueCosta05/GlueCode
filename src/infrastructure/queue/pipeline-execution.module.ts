import { Module } from '@nestjs/common';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { StepExecutorModule } from '@/infrastructure/execution/step-executor.module';
import { QueueModule } from './queue.module';
import { PipelineExecutionProcessor } from './pipeline-execution.processor';

@Module({
  imports: [
    ExecutionModule,
    PipelineModule,
    LogEntryModule,
    StepExecutorModule,
    QueueModule,
  ],
  providers: [PipelineExecutionProcessor],
})
export class PipelineExecutionModule {}
