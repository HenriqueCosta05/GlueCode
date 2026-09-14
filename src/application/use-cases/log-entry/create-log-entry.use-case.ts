import { Inject, Injectable } from '@nestjs/common';
import { CreateLogEntryDTO } from '@/application/dtos/log-entry/create-log-entry.dto';
import type { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntry } from '@/domain/entities/log-entry';
import { generateID } from '@/shared/utils/StringUtils';

@Injectable()
export class CreateLogEntryUseCase {
  constructor(
    @Inject(LOG_ENTRY_REPOSITORY)
    private readonly logEntryRepository: LogEntryRepository,
  ) {}

  public async execute(request: CreateLogEntryDTO): Promise<boolean> {
    const { level, message, context, executionId } = request;

    const id = generateID();

    const logEntry = new LogEntry(id, level, message, context, executionId);

    const created = await this.logEntryRepository.createLogEntry(logEntry);

    return created;
  }
}
