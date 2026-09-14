import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { ExecutionId } from '@/@types/IDs';
import type { LogLevel } from '@/domain/entities/log-entry';

export class CreateLogEntryRequestDto {
  @IsIn(['info', 'warn', 'error'])
  level!: LogLevel;

  @IsString()
  message!: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  executionId?: ExecutionId;
}
