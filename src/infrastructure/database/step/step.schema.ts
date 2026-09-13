import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StepConfig } from '@/@types/domain';
import { StepKind } from '@/@types/enums';

@Schema({ collection: 'steps', timestamps: true, _id: false })
export class StepSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, enum: Object.values(StepKind), required: true })
  kind: StepKind;

  @Prop({ type: Object, required: true })
  config: StepConfig;
}

export type StepDocument = HydratedDocument<StepSchemaClass>;
export const StepSchema = SchemaFactory.createForClass(StepSchemaClass);
