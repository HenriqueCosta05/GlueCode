import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { StepKind } from '@/@types/enums';
import { STEP_REPOSITORY } from '@/application/tokens';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { StepModule } from './step.module';

describe('StepMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: StepRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        StepModule,
      ],
    }).compile();

    repository = moduleRef.get<StepRepository>(STEP_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  it('creates, reads, updates, lists and deletes a step', async () => {
    const step = new Step('s1', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'info',
    });

    expect(await repository.createStep(step)).toBe(true);

    const found = await repository.existsById('s1');
    expect(found?.id).toBe('s1');
    expect(found?.kind).toBe(StepKind.LOG);

    const updated = await repository.updateStep(
      new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'error' }),
    );
    expect(updated?.config).toEqual({ kind: StepKind.LOG, level: 'error' });

    const all = await repository.getAllSteps();
    expect(all).toHaveLength(1);

    expect(await repository.deleteStep(step)).toBe(true);
    expect(await repository.existsById('s1')).toBeNull();
  });
});
