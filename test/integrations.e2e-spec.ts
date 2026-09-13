import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { PipelineStatus, StepKind } from '@/@types/enums';
import { Schema } from '@/@types/schema';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { IntegrationsModule } from '@/presentation/integrations/integrations.module';

describe('IntegrationsController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        PipelineModule,
        IntegrationsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates, lists, fetches, updates and deletes an integration', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/integrations')
      .send({
        name: 'My Integration',
        steps: [
          {
            id: 's1',
            kind: StepKind.LOG,
            config: { kind: StepKind.LOG, level: 'info' },
          },
        ],
      })
      .expect(201);

    const createBody = createResponse.body as Schema;
    const id = createBody.pipeline.id;
    expect(createBody.pipeline.name).toBe('My Integration');

    await request(app.getHttpServer())
      .get('/integrations')
      .expect(200)
      .expect((res) => {
        expect(res.body as Schema[]).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(`/integrations/${id}`)
      .expect(200)
      .expect((res) => {
        expect((res.body as Schema).pipeline.id).toBe(id);
      });

    await request(app.getHttpServer())
      .patch(`/integrations/${id}`)
      .send({
        name: 'Renamed',
        steps: [
          {
            id: 's1',
            kind: StepKind.LOG,
            config: { kind: StepKind.LOG, level: 'error' },
          },
        ],
      })
      .expect(200)
      .expect((res) => {
        expect((res.body as Schema).pipeline.name).toBe('Renamed');
      });

    await request(app.getHttpServer())
      .delete(`/integrations/${id}`)
      .expect(204);

    await request(app.getHttpServer()).get(`/integrations/${id}`).expect(404);
  });

  it('preserves the existing status on PATCH when status is omitted', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/integrations')
      .send({
        name: 'Status Preservation',
        status: PipelineStatus.COMPLETED,
        steps: [
          {
            id: 's1',
            kind: StepKind.LOG,
            config: { kind: StepKind.LOG, level: 'info' },
          },
        ],
      })
      .expect(201);

    const createBody = createResponse.body as Schema;
    const id = createBody.pipeline.id;
    expect(createBody.pipeline.status).toBe(PipelineStatus.COMPLETED);

    await request(app.getHttpServer())
      .patch(`/integrations/${id}`)
      .send({
        name: 'Status Preservation Renamed',
        steps: [
          {
            id: 's1',
            kind: StepKind.LOG,
            config: { kind: StepKind.LOG, level: 'info' },
          },
        ],
      })
      .expect(200)
      .expect((res) => {
        const schema = res.body as Schema;
        expect(schema.pipeline.name).toBe('Status Preservation Renamed');
        expect(schema.pipeline.status).toBe(PipelineStatus.COMPLETED);
      });
  });
});
