import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';
import { ExecutionModule } from './execution.module';

describe('ExecutionMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: ExecutionRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        ExecutionModule,
      ],
    }).compile();

    repository = moduleRef.get<ExecutionRepository>(EXECUTION_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  it('creates, reads, updates, lists and deletes an execution', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const execution = new Execution('e1', 'p1', 'PENDING', startedAt);

    expect(await repository.createExecution(execution)).toBe(true);

    const found = await repository.existsById('e1');
    expect(found?.status).toBe('PENDING');

    const completedAt = new Date('2026-01-01T00:05:00.000Z');
    const updated = await repository.updateExecution(
      new Execution('e1', 'p1', 'COMPLETED', startedAt, completedAt),
    );
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.completedAt?.toISOString()).toBe(completedAt.toISOString());

    const all = await repository.getAllExecutions();
    expect(all).toHaveLength(1);

    expect(await repository.deleteExecution(execution)).toBe(true);
    expect(await repository.existsById('e1')).toBeNull();
  });
});
