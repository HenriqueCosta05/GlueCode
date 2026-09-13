import { Mapper } from '@/base/mapper';
import { Connector } from '@/domain/entities/connector';
import { ConnectorDocument, ConnectorSchemaClass } from './connector.schema';

export class ConnectorMapper extends Mapper<
  Partial<ConnectorSchemaClass>,
  Connector
> {
  mapFrom(input: ConnectorDocument): Connector {
    return new Connector(
      input._id,
      input.source,
      input.schema,
      input.mapping,
      input.destination,
      input.auth,
    );
  }

  mapTo(input: Connector): Partial<ConnectorSchemaClass> {
    return {
      _id: input.id,
      source: input.source,
      schema: input.schema,
      mapping: input.mapping,
      destination: input.destination,
      auth: input.auth,
    };
  }
}
