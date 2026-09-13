import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { MongoLoggerService } from './mongo-logger.service';

describe('MongoLoggerService', () => {
  it('delegates to CreateLogEntryUseCase with the given fields', async () => {
    const createLogEntryUseCase = {
      execute: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<CreateLogEntryUseCase>;
    const service = new MongoLoggerService(createLogEntryUseCase);

    await service.log('warn', 'careful', { stepId: 's1' }, 'e1');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(createLogEntryUseCase.execute).toHaveBeenCalledWith({
      level: 'warn',
      message: 'careful',
      context: { stepId: 's1' },
      executionId: 'e1',
    });
  });
});
