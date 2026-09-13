import { CreateConnectorDTO } from '@/application/dtos/connector/create-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { generateID } from '@/infrastructure/utils/StringUtils';

export class CreateConnectorUseCase {
  constructor(private readonly connectorRepository: ConnectorRepository) {}

  public async execute(request: CreateConnectorDTO): Promise<boolean> {
    const { source, schema, mapping, destination, auth } = request;

    const id = generateID();

    const connector = new Connector(
      id,
      source,
      schema,
      mapping,
      destination,
      auth,
    );

    const created = await this.connectorRepository.createConnector(connector);

    return created;
  }
}
