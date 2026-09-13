import { StepKind } from '@/@types/enums';
import { ReceiveStepExecutor } from './receive-step.executor';
import { ValidateStepExecutor } from './validate-step.executor';
import { TransformStepExecutor } from './transform-step.executor';
import { DispatchStepExecutor } from './dispatch-step.executor';
import { LogStepExecutor } from './log-step.executor';
import { buildStepExecutorRegistry } from './step-executor.registry';

describe('buildStepExecutorRegistry', () => {
  it('maps every StepKind to its executor', () => {
    const receive = new ReceiveStepExecutor();
    const validate = new ValidateStepExecutor();
    const transform = new TransformStepExecutor();
    const dispatch = new DispatchStepExecutor();
    const log = new LogStepExecutor({ log: jest.fn() });

    const registry = buildStepExecutorRegistry(
      receive,
      validate,
      transform,
      dispatch,
      log,
    );

    expect(registry[StepKind.RECEIVE]).toBe(receive);
    expect(registry[StepKind.VALIDATE]).toBe(validate);
    expect(registry[StepKind.TRANSFORM]).toBe(transform);
    expect(registry[StepKind.DISPATCH]).toBe(dispatch);
    expect(registry[StepKind.LOG]).toBe(log);
  });
});
