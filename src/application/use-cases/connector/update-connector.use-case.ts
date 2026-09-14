import { Inject, Injectable } from '@nestjs/common';
import { UpdateConnectorDTO } from '@/application/dtos/connector/update-connector.dto';
import type { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';

@Injectable()
export class UpdateConnectorUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

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
