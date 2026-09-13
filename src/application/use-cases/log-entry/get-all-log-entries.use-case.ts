import { Inject, Injectable } from '@nestjs/common';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntry } from '@/domain/entities/log-entry';

@Injectable()
export class GetAllLogEntriesUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(): Promise<LogEntry[]> {
    const logEntries = await this.logEntryRepository.getAllLogEntries();

    return logEntries;
  }
}
