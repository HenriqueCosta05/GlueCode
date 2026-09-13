import { AddressInfo } from 'net';
import { Server } from 'http';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io, Socket } from 'socket.io-client';
import { StepKind } from '@/@types/enums';
import { Schema } from '@/@types/schema';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { IntegrationsModule } from './integrations.module';

describe('IntegrationsGateway (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let client: Socket;
  let baseUrl: string;

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
    await app.listen(0);
    const address = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}/integrations`;
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  afterEach(() => {
    client?.disconnect();
  });

  it('creates an integration over WS and receives the broadcast', (done) => {
    client = io(baseUrl, { transports: ['websocket'] });

    client.on('connect', () => {
      client.on('integration.created', (schema: Schema) => {
        expect(schema.pipeline.name).toBe('WS Integration');
        done();
      });

      client.emit(
        'integration:create',
        {
          name: 'WS Integration',
          steps: [
            {
              id: 's1',
              kind: StepKind.LOG,
              config: { kind: StepKind.LOG, level: 'info' },
            },
          ],
        },
        () => {},
      );
    });
  });
});
