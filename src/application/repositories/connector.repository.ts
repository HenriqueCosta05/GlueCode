import { Connector } from '@/domain/entities/connector';

export interface ConnectorRepository {
  createConnector(connector: Connector): Promise<boolean>;
  updateConnector(connector: Connector): Promise<Connector | null>;
  deleteConnector(connector: Connector): Promise<boolean>;
  existsById(connectorId: string): Promise<Connector | null>;
  getAllConnectors(): Promise<Connector[]>;
}
