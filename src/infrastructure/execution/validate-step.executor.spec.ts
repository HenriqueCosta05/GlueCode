import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { ValidateStepExecutor } from './validate-step.executor';

describe('ValidateStepExecutor', () => {
  const step = new Step('s1', StepKind.VALIDATE, {
    kind: StepKind.VALIDATE,
    schema: { email: 'string', age: 'number' },
  });
  const executor = new ValidateStepExecutor();

  it('succeeds when every schema key is present on the payload', async () => {
    const result = await executor.execute(step, {
      email: 'a@b.com',
      age: 30,
    });

    expect(result.status).toBe('SUCCESS');
  });

  it('fails when a schema key is missing from the payload', async () => {
    const result = await executor.execute(step, { email: 'a@b.com' });

    expect(result.status).toBe('FAILED');
  });
});
