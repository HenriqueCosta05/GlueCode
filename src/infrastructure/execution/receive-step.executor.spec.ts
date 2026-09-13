import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { ReceiveStepExecutor } from './receive-step.executor';

describe('ReceiveStepExecutor', () => {
  it('passes the payload through unchanged', async () => {
    const step = new Step('s1', StepKind.RECEIVE, {
      kind: StepKind.RECEIVE,
      source: { url: 'https://source.test', method: 'GET' },
    });
    const executor = new ReceiveStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({ hello: 'world' });
  });
});
