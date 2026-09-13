import { Inject, Injectable } from '@nestjs/common';
import { GetConnectorByIdDTO } from '@/application/dtos/connector/get-connector-by-id.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { Connector } from '@/domain/entities/connector';

@Injectable()
export class GetConnectorByIdUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(
    request: GetConnectorByIdDTO,
  ): Promise<Connector | null> {
    const { id } = request;

    const connector = await this.connectorRepository.existsById(id);

    return connector;
  }
}
