import { Mapper } from '@/base/mapper';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryDocument, LogEntrySchemaClass } from './log-entry.schema';

export class LogEntryMapper extends Mapper<
  Partial<LogEntrySchemaClass>,
  LogEntry
> {
  mapFrom(input: LogEntryDocument): LogEntry {
    return new LogEntry(
      input._id,
      input.level,
      input.message,
      input.context,
      input.executionId,
    );
  }

  mapTo(input: LogEntry): Partial<LogEntrySchemaClass> {
    return {
      _id: input.id,
      level: input.level,
      message: input.message,
      context: input.context,
      executionId: input.executionId,
    };
  }
}
