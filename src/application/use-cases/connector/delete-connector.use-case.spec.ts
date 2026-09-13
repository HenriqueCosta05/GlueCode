import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { ConnectorNotFoundError } from '@/shared/errors/domain';
import { DeleteConnectorUseCase } from './delete-connector.use-case';

const buildConnector = () =>
  new Connector(
    'c1',
    { url: 'https://source.test', method: 'GET' },
    {},
    [],
    { url: 'https://dest.test', method: 'POST' },
    { type: 'none' },
  );

describe('DeleteConnectorUseCase', () => {
  it('throws ConnectorNotFoundError when missing', async () => {
    const repository: jest.Mocked<ConnectorRepository> = {
      createConnector: jest.fn(),
      updateConnector: jest.fn(),
      deleteConnector: jest.fn(),
      existsById: jest.fn().mockResolvedValue(null),
      getAllConnectors: jest.fn(),
    };
    const useCase = new DeleteConnectorUseCase(repository);

    await expect(useCase.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      ConnectorNotFoundError,
    );
  });

  it('deletes an existing connector', async () => {
    const existing = buildConnector();
    const repository: jest.Mocked<ConnectorRepository> = {
      createConnector: jest.fn(),
      updateConnector: jest.fn(),
      deleteConnector: jest.fn().mockResolvedValue(true),
      existsById: jest.fn().mockResolvedValue(existing),
      getAllConnectors: jest.fn(),
    };
    const useCase = new DeleteConnectorUseCase(repository);

    const result = await useCase.execute({ id: 'c1' });

    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.deleteConnector).toHaveBeenCalledWith(existing);
  });
});
