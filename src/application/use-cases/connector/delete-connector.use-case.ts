import { DeleteConnectorDTO } from '@/application/dtos/connector/delete-connector.dto';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { ConnectorNotFoundError } from '@/shared/errors/domain';

export class DeleteConnectorUseCase {
  constructor(private readonly connectorRepository: ConnectorRepository) {}

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
