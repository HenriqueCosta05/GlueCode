import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryModule } from '@/infrastructure/database/log-entry/log-entry.module';
import { LogsModule } from '@/presentation/logs/logs.module';

describe('LogsController (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        LogEntryModule,
        LogsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  it('creates, lists, fetches and deletes a log entry', async () => {
    await request(app.getHttpServer())
      .post('/logs')
      .send({ level: 'info', message: 'hello' })
      .expect(201)
      .expect((res) => {
        expect((res.body as { created: boolean }).created).toBe(true);
      });

    const list = await request(app.getHttpServer()).get('/logs').expect(200);
    const logEntries = list.body as LogEntry[];
    expect(logEntries).toHaveLength(1);

    const id = logEntries[0].id;

    await request(app.getHttpServer())
      .get(`/logs/${id}`)
      .expect(200)
      .expect((res) => {
        expect((res.body as LogEntry).message).toBe('hello');
      });

    await request(app.getHttpServer()).delete(`/logs/${id}`).expect(204);

    await request(app.getHttpServer()).get(`/logs/${id}`).expect(404);
  });
});
