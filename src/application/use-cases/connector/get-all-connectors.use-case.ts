import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';

export class GetAllConnectorsUseCase {
  constructor(private readonly connectorRepository: ConnectorRepository) {}

  public async execute(): Promise<Connector[]> {
    const connectors = await this.connectorRepository.getAllConnectors();

    return connectors;
  }
}
