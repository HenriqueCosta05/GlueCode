import { StepKind } from '@/@types/enums';
import { Step } from '@/domain/entities/step';
import { DispatchStepExecutor } from './dispatch-step.executor';

describe('DispatchStepExecutor', () => {
  const step = new Step('s1', StepKind.DISPATCH, {
    kind: StepKind.DISPATCH,
    destination: { url: 'https://dest.test/webhook', method: 'POST' },
    auth: { type: 'none' },
  });

  beforeEach(() => {
    // Ensure fetch is available before each test

    if (typeof (global as Record<string, unknown>).fetch === 'undefined') {
      (global as Record<string, unknown>).fetch = jest.fn();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns SUCCESS with the response body on a 2xx response', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ received: true }),
    });
    const executor = new DispatchStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('SUCCESS');
    expect(result.payload).toEqual({ received: true });

    expect((global as Record<string, unknown>).fetch).toHaveBeenCalledWith(
      'https://dest.test/webhook',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ hello: 'world' }),
      }),
    );
  });

  it('returns FAILED on a non-2xx response', async () => {
    jest.spyOn(global, 'fetch' as never).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    const executor = new DispatchStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('FAILED');
  });

  it('returns FAILED when fetch throws', async () => {
    jest
      .spyOn(global, 'fetch' as never)
      .mockRejectedValue(new Error('network down'));
    const executor = new DispatchStepExecutor();

    const result = await executor.execute(step, { hello: 'world' });

    expect(result.status).toBe('FAILED');
  });
});
