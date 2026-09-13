import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { StepKind, PipelineStatus } from '@/@types/enums';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';
import { PipelineModule } from './pipeline.module';

describe('PipelineMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: PipelineRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        PipelineModule,
      ],
    }).compile();

    repository = moduleRef.get<PipelineRepository>(PIPELINE_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  const buildPipeline = () =>
    new Pipeline(
      'p1',
      [new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' })],
      PipelineStatus.IDLE,
      'My Pipeline',
      'A description',
    );

  it('creates, reads, updates, lists and deletes a pipeline with embedded steps', async () => {
    const pipeline = buildPipeline();

    expect(await repository.createPipeline(pipeline)).toBe(true);

    const found = await repository.existsById('p1');
    expect(found?.name).toBe('My Pipeline');
    expect(found?.getSteps()).toHaveLength(1);
    expect(found?.getSteps()[0].kind).toBe(StepKind.LOG);

    const updated = await repository.updatePipeline(
      new Pipeline(
        'p1',
        [new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'error' })],
        PipelineStatus.COMPLETED,
        'Renamed',
      ),
    );
    expect(updated?.name).toBe('Renamed');
    expect(updated?.status).toBe(PipelineStatus.COMPLETED);

    const all = await repository.getAllPipelines();
    expect(all).toHaveLength(1);

    expect(await repository.deletePipeline(pipeline)).toBe(true);
    expect(await repository.existsById('p1')).toBeNull();
  });
});
