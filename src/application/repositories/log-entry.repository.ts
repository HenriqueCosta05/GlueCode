import { LogEntry } from '@/domain/entities/log-entry';

export interface LogEntryRepository {
  createLogEntry(logEntry: LogEntry): Promise<boolean>;
  deleteLogEntry(logEntry: LogEntry): Promise<boolean>;
  existsById(logEntryId: string): Promise<LogEntry | null>;
  getAllLogEntries(): Promise<LogEntry[]>;
}
