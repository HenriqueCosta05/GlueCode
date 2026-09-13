import { Provider } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { STEP_EXECUTOR_REGISTRY } from '@/application/tokens';
import { StepExecutor } from './step-executor';
import { ReceiveStepExecutor } from './receive-step.executor';
import { ValidateStepExecutor } from './validate-step.executor';
import { TransformStepExecutor } from './transform-step.executor';
import { DispatchStepExecutor } from './dispatch-step.executor';
import { LogStepExecutor } from './log-step.executor';

export type StepExecutorRegistry = Record<StepKind, StepExecutor>;

export function buildStepExecutorRegistry(
  receive: ReceiveStepExecutor,
  validate: ValidateStepExecutor,
  transform: TransformStepExecutor,
  dispatch: DispatchStepExecutor,
  log: LogStepExecutor,
): StepExecutorRegistry {
  return {
    [StepKind.RECEIVE]: receive,
    [StepKind.VALIDATE]: validate,
    [StepKind.TRANSFORM]: transform,
    [StepKind.DISPATCH]: dispatch,
    [StepKind.LOG]: log,
  };
}

export const stepExecutorRegistryProvider: Provider = {
  provide: STEP_EXECUTOR_REGISTRY,
  useFactory: buildStepExecutorRegistry,
  inject: [
    ReceiveStepExecutor,
    ValidateStepExecutor,
    TransformStepExecutor,
    DispatchStepExecutor,
    LogStepExecutor,
  ],
};
