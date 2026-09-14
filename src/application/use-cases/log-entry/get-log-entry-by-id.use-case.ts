import { Inject, Injectable } from '@nestjs/common';
import { GetLogEntryByIdDTO } from '@/application/dtos/log-entry/get-log-entry-by-id.dto';
import type { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntry } from '@/domain/entities/log-entry';

@Injectable()
export class GetLogEntryByIdUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(request: GetLogEntryByIdDTO): Promise<LogEntry | null> {
    const { id } = request;

    const logEntry = await this.logEntryRepository.existsById(id);

    return logEntry;
  }
}
