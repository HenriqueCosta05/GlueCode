import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryNotFoundError } from '@/shared/errors/domain';
import { DeleteLogEntryUseCase } from './delete-log-entry.use-case';

describe('DeleteLogEntryUseCase', () => {
  it('throws LogEntryNotFoundError when missing', async () => {
    const repository: jest.Mocked<LogEntryRepository> = {
      createLogEntry: jest.fn(),
      deleteLogEntry: jest.fn(),
      existsById: jest.fn().mockResolvedValue(null),
      getAllLogEntries: jest.fn(),
    };
    const useCase = new DeleteLogEntryUseCase(repository);

    await expect(useCase.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      LogEntryNotFoundError,
    );
  });

  it('deletes an existing log entry', async () => {
    const existing = new LogEntry('l1', 'info', 'hello');
    const repository: jest.Mocked<LogEntryRepository> = {
      createLogEntry: jest.fn(),
      deleteLogEntry: jest.fn().mockResolvedValue(true),
      existsById: jest.fn().mockResolvedValue(existing),
      getAllLogEntries: jest.fn(),
    };
    const useCase = new DeleteLogEntryUseCase(repository);

    const result = await useCase.execute({ id: 'l1' });

    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.deleteLogEntry).toHaveBeenCalledWith(existing);
  });
});
