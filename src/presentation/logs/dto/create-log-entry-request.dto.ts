import { ExecutionId } from '@/@types/IDs';
import { LogLevel } from '@/domain/entities/log-entry';

export class CreateLogEntryRequestDto {
  level!: LogLevel;
  message!: string;
  context?: Record<string, unknown>;
  executionId?: ExecutionId;
}
