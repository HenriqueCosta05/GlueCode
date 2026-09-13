import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { TransformStepExecutor } from './transform-step.executor';

describe('TransformStepExecutor', () => {
  it('applies field mappings, including toUpperCase', async () => {
    const step = new Step('s1', StepKind.TRANSFORM, {
      kind: StepKind.TRANSFORM,
      mapping: [
        {
          sourcePath: '$.customer.email',
          targetPath: '$.contact.email_address',
          transform: 'toUpperCase',
        },
      ],
    });
    const executor = new TransformStepExecutor();

    const result = await executor.execute(step, {
      customer: { email: 'a@b.com' },
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({
      contact: { email_address: 'A@B.COM' },
    });
  });
});
