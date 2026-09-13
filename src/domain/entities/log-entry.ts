import { ExecutionId, LogEntryId } from '@/@types/IDs';
import { Entity } from '@/base/entity';

export type LogLevel = 'info' | 'warn' | 'error';

export class LogEntry extends Entity {
  constructor(
    readonly id: LogEntryId,
    readonly level: LogLevel,
    readonly message: string,
    readonly context?: Record<string, unknown>,
    readonly executionId?: ExecutionId,
  ) {
    super();
  }
}
