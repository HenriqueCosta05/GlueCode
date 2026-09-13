import { Module } from '@nestjs/common';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { STEP_EXECUTOR_REGISTRY } from '@/application/tokens';
import { ReceiveStepExecutor } from './receive-step.executor';
import { ValidateStepExecutor } from './validate-step.executor';
import { TransformStepExecutor } from './transform-step.executor';
import { DispatchStepExecutor } from './dispatch-step.executor';
import { LogStepExecutor } from './log-step.executor';
import { stepExecutorRegistryProvider } from './step-executor.registry';

@Module({
  imports: [LogEntryModule],
  providers: [
    ReceiveStepExecutor,
    ValidateStepExecutor,
    TransformStepExecutor,
    DispatchStepExecutor,
    LogStepExecutor,
    stepExecutorRegistryProvider,
  ],
  exports: [STEP_EXECUTOR_REGISTRY],
})
export class StepExecutorModule {}
