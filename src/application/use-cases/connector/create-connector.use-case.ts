import { Inject, Injectable } from '@nestjs/common';
import { CreateConnectorDTO } from '@/application/dtos/connector/create-connector.dto';
import type { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';
import { generateID } from '@/shared/utils/StringUtils';

@Injectable()
export class CreateConnectorUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

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
