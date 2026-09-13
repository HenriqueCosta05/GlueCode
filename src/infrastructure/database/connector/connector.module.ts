import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { CreateConnectorUseCase } from '@/application/use-cases/connector/create-connector.use-case';
import { UpdateConnectorUseCase } from '@/application/use-cases/connector/update-connector.use-case';
import { DeleteConnectorUseCase } from '@/application/use-cases/connector/delete-connector.use-case';
import { GetConnectorByIdUseCase } from '@/application/use-cases/connector/get-connector-by-id.use-case';
import { GetAllConnectorsUseCase } from '@/application/use-cases/connector/get-all-connectors.use-case';
import { ConnectorSchema, ConnectorSchemaClass } from './connector.schema';
import { ConnectorMongoRepository } from './connector.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ConnectorSchemaClass.name, schema: ConnectorSchema },
    ]),
  ],
  providers: [
    { provide: CONNECTOR_REPOSITORY, useClass: ConnectorMongoRepository },
    CreateConnectorUseCase,
    UpdateConnectorUseCase,
    DeleteConnectorUseCase,
    GetConnectorByIdUseCase,
    GetAllConnectorsUseCase,
  ],
  exports: [
    CONNECTOR_REPOSITORY,
    CreateConnectorUseCase,
    UpdateConnectorUseCase,
    DeleteConnectorUseCase,
    GetConnectorByIdUseCase,
    GetAllConnectorsUseCase,
  ],
})
export class ConnectorModule {}
