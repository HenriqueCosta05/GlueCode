import { Injectable } from '@nestjs/common';
import { ExecutionId } from '@/@types/IDs';
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { LoggerPort } from '@/application/ports/logger.port';
import { LogLevel } from '@/domain/entities/log-entry';

@Injectable()
export class MongoLoggerService implements LoggerPort {
  constructor(private readonly createLogEntryUseCase: CreateLogEntryUseCase) {}

  async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    executionId?: ExecutionId,
  ): Promise<void> {
    await this.createLogEntryUseCase.execute({
      level,
      message,
      context,
      executionId,
    });
  }
}
