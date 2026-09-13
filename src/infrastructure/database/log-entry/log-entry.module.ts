import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LOG_ENTRY_REPOSITORY, LOGGER_PORT } from '@/application/tokens';
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { DeleteLogEntryUseCase } from '@/application/use-cases/log-entry/delete-log-entry.use-case';
import { GetLogEntryByIdUseCase } from '@/application/use-cases/log-entry/get-log-entry-by-id.use-case';
import { GetAllLogEntriesUseCase } from '@/application/use-cases/log-entry/get-all-log-entries.use-case';
import { LogEntrySchema, LogEntrySchemaClass } from './log-entry.schema';
import { LogEntryMongoRepository } from './log-entry.mongo.repository';
import { MongoLoggerService } from '../../logging/mongo-logger.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LogEntrySchemaClass.name, schema: LogEntrySchema },
    ]),
  ],
  providers: [
    { provide: LOG_ENTRY_REPOSITORY, useClass: LogEntryMongoRepository },
    { provide: LOGGER_PORT, useClass: MongoLoggerService },
    CreateLogEntryUseCase,
    DeleteLogEntryUseCase,
    GetLogEntryByIdUseCase,
    GetAllLogEntriesUseCase,
  ],
  exports: [
    LOG_ENTRY_REPOSITORY,
    LOGGER_PORT,
    CreateLogEntryUseCase,
    DeleteLogEntryUseCase,
    GetLogEntryByIdUseCase,
    GetAllLogEntriesUseCase,
  ],
})
export class LogEntryModule {}
