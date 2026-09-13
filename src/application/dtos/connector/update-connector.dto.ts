import {
  AuthSpec,
  EndpointSpec,
  FieldMapping,
  JsonSchema,
} from '@/@types/domain';
import { ConnectorId } from '@/@types/IDs';

export interface UpdateConnectorDTO {
  id: ConnectorId;
  source: EndpointSpec;
  schema: JsonSchema;
  mapping: FieldMapping[];
  destination: EndpointSpec;
  auth: AuthSpec;
}
