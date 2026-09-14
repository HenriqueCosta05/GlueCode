import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  AuthSpec,
  EndpointSpec,
  FieldMapping,
  JsonSchema,
} from '@/@types/domain';

@Schema({ collection: 'connectors', timestamps: true, _id: false })
export class ConnectorSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: Object, required: true })
  source: EndpointSpec;

  @Prop({ type: Object, required: true })
  schema: JsonSchema;

  @Prop({ type: [Object], required: true })
  mapping: FieldMapping[];

  @Prop({ type: Object, required: true })
  destination: EndpointSpec;

  @Prop({ type: Object, required: true })
  auth: AuthSpec;
}

export type ConnectorDocument = HydratedDocument<ConnectorSchemaClass>;
export const ConnectorSchema =
  SchemaFactory.createForClass(ConnectorSchemaClass);
