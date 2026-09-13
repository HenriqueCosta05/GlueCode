import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { LoggerPort } from '@/application/ports/logger.port';
import { LogStepExecutor } from './log-step.executor';

describe('LogStepExecutor', () => {
  it('logs via LoggerPort and passes the payload through', async () => {
    const logger: jest.Mocked<LoggerPort> = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const step = new Step('s1', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'error',
    });
    const executor = new LogStepExecutor(logger);

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({ hello: 'world' });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(logger.log).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('s1'),
      { payload: { hello: 'world' } },
    );
  });
});
