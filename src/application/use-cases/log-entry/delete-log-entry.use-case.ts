import { Inject, Injectable } from '@nestjs/common';
import { DeleteLogEntryDTO } from '@/application/dtos/log-entry/delete-log-entry.dto';
import type { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntryNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteLogEntryUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(request: DeleteLogEntryDTO): Promise<boolean> {
    const { id } = request;

    const existing = await this.logEntryRepository.existsById(id);

    if (!existing) {
      throw new LogEntryNotFoundError(`Log entry with id ${id} was not found.`);
    }

    const deleted = await this.logEntryRepository.deleteLogEntry(existing);

    return deleted;
  }
}
