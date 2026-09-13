import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { ConnectorModule } from './connector.module';

describe('ConnectorMongoRepository', () => {
  let mongod: MongoMemoryServer;
  let repository: ConnectorRepository;
  let closeModule: () => Promise<void>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRoot(mongod.getUri()),
        ConnectorModule,
      ],
    }).compile();

    repository = moduleRef.get<ConnectorRepository>(CONNECTOR_REPOSITORY);
    closeModule = () => moduleRef.close();
  });

  afterAll(async () => {
    await closeModule();
    await mongod.stop();
  });

  const buildConnector = () =>
    new Connector(
      'c1',
      { url: 'https://source.test', method: 'GET' },
      { type: 'object' },
      [{ sourcePath: '$.a', targetPath: '$.b', transform: 'identity' }],
      { url: 'https://dest.test', method: 'POST' },
      { type: 'none' },
    );

  it('creates, reads, updates, lists and deletes a connector', async () => {
    const connector = buildConnector();

    expect(await repository.createConnector(connector)).toBe(true);

    const found = await repository.existsById('c1');
    expect(found?.destination.url).toBe('https://dest.test');

    const updated = await repository.updateConnector(
      new Connector(
        'c1',
        connector.source,
        connector.schema,
        connector.mapping,
        { url: 'https://new-dest.test', method: 'PUT' },
        connector.auth,
      ),
    );
    expect(updated?.destination.url).toBe('https://new-dest.test');

    const all = await repository.getAllConnectors();
    expect(all).toHaveLength(1);

    expect(await repository.deleteConnector(connector)).toBe(true);
    expect(await repository.existsById('c1')).toBeNull();
  });
});
