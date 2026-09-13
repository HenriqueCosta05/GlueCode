import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { LOG_ENTRY_REPOSITORY } from '@/application/tokens';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryModule } from './log-entry.module';

describe('LogEntryMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: LogEntryRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        LogEntryModule,
      ],
    }).compile();

    repository = moduleRef.get<LogEntryRepository>(LOG_ENTRY_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  it('creates, reads, lists and deletes a log entry', async () => {
    const entry = new LogEntry('l1', 'info', 'hello', { a: 1 }, 'e1');

    expect(await repository.createLogEntry(entry)).toBe(true);

    const found = await repository.existsById('l1');
    expect(found?.message).toBe('hello');
    expect(found?.executionId).toBe('e1');

    const all = await repository.getAllLogEntries();
    expect(all).toHaveLength(1);

    expect(await repository.deleteLogEntry(entry)).toBe(true);
    expect(await repository.existsById('l1')).toBeNull();
  });
});
