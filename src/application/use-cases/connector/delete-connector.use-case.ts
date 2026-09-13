import { Inject, Injectable } from '@nestjs/common';
import { DeleteConnectorDTO } from '@/application/dtos/connector/delete-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { CONNECTOR_REPOSITORY } from '@/application/tokens';
import { ConnectorNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteConnectorUseCase {
  constructor(
    @Inject(CONNECTOR_REPOSITORY)
    private readonly connectorRepository: ConnectorRepository,
  ) {}

  public async execute(request: DeleteConnectorDTO): Promise<boolean> {
    const { id } = request;

    const existingConnector = await this.connectorRepository.existsById(id);

    if (!existingConnector) {
      throw new ConnectorNotFoundError(
        `Connector with id ${id} was not found.`,
      );
    }

    const deleted =
      await this.connectorRepository.deleteConnector(existingConnector);

    return deleted;
  }
}
