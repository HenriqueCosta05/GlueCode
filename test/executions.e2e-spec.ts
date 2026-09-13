import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { PIPELINE_EXECUTION_QUEUE } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';
import { ExecutionModule } from '@/infrastructure/database/execution/execution.module';
import { ExecutionsModule } from '@/presentation/executions/executions.module';

describe('ExecutionsController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;
  const fakeQueue = { add: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        ExecutionModule,
        ExecutionsModule,
      ],
    })
      .overrideProvider(getQueueToken(PIPELINE_EXECUTION_QUEUE))
      .useValue(fakeQueue)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates an execution, enqueues a job, and lists/fetches it', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/executions')
      .send({ pipelineId: 'p1' })
      .expect(202);

    const created = createResponse.body as Execution;
    expect(created.pipelineId).toBe('p1');
    expect(created.status).toBe('PENDING');
    const id = created.id;

    expect(fakeQueue.add).toHaveBeenCalledWith(PIPELINE_EXECUTION_QUEUE, {
      executionId: id,
    });

    await request(app.getHttpServer())
      .get('/executions')
      .expect(200)
      .expect((res) => {
        expect(res.body as Execution[]).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/executions/${id}`)
      .expect(200)
      .expect((res) => {
        expect((res.body as Execution).id).toBe(id);
      });
  });
});
