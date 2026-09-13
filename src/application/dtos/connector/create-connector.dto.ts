import {
  AuthSpec,
  EndpointSpec,
  FieldMapping,
  JsonSchema,
} from '@/@types/domain';

export interface CreateConnectorDTO {
  source: EndpointSpec;
  schema: JsonSchema;
  mapping: FieldMapping[];
  destination: EndpointSpec;
  auth: AuthSpec;
}
