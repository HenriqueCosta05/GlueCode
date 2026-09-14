import { Inject, Injectable } from '@nestjs/common';
import type { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';

@Injectable()
export class GetAllConnectorsUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(): Promise<Connector[]> {
    const connectors = await this.connectorRepository.getAllConnectors();

    return connectors;
  }
}
