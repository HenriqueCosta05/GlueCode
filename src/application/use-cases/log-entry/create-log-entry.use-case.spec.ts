import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { CreateLogEntryUseCase } from './create-log-entry.use-case';

describe('CreateLogEntryUseCase', () => {
  it('builds a LogEntry and delegates to the repository', async () => {
    const repository: jest.Mocked<LogEntryRepository> = {
      createLogEntry: jest.fn().mockResolvedValue(true),
      deleteLogEntry: jest.fn(),
      existsById: jest.fn(),
      getAllLogEntries: jest.fn(),
    };
    const useCase = new CreateLogEntryUseCase(repository);

    const created = await useCase.execute({
      level: 'info',
      message: 'hello',
    });

    expect(created).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createLogEntry).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const mock = repository.createLogEntry as jest.Mock;
    const [logEntry] = mock.mock.calls[0] as [LogEntry];
    expect(logEntry.level).toBe('info');
    expect(logEntry.message).toBe('hello');
  });
});
