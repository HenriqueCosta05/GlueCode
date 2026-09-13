import { UpdateConnectorDTO } from '@/application/dtos/connector/update-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';

export class UpdateConnectorUseCase {
  constructor(private readonly connectorRepository: ConnectorRepository) {}

  public async execute(request: UpdateConnectorDTO): Promise<Connector | null> {
    const { id, source, schema, mapping, destination, auth } = request;

    const connector = new Connector(
      id,
      source,
      schema,
      mapping,
      destination,
      auth,
    );

    const updated = await this.connectorRepository.updateConnector(connector);

    return updated;
  }
}
