import { GetConnectorByIdDTO } from '@/application/dtos/connector/get-connector-by-id.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';

export class GetConnectorByIdUseCase {
  constructor(private readonly connectorRepository: ConnectorRepository) {}

  public async execute(
    request: GetConnectorByIdDTO,
  ): Promise<Connector | null> {
    const { id } = request;

    const connector = await this.connectorRepository.existsById(id);

    return connector;
  }
}
