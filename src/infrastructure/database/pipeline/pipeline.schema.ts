import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { StepConfig } from '@/@types/domain';
import { PipelineStatus, StepKind } from '@/@types/enums';

@Schema({ _id: false })
export class EmbeddedStepSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, enum: Object.values(StepKind), required: true })
  kind: StepKind;

  @Prop({ type: Object, required: true })
  config: StepConfig;
}

export const EmbeddedStepSchema = SchemaFactory.createForClass(
  EmbeddedStepSchemaClass,
);

@Schema({ collection: 'pipelines', timestamps: true, _id: false })
export class PipelineSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: [EmbeddedStepSchema], required: true })
  steps: EmbeddedStepSchemaClass[];

  @Prop({
    type: String,
    enum: Object.values(PipelineStatus),
    required: true,
    default: PipelineStatus.IDLE,
  })
  status: PipelineStatus;

  @Prop({ type: String })
  name?: string;

  @Prop({ type: String })
  description?: string;
}

export type PipelineDocument = HydratedDocument<PipelineSchemaClass>;
export const PipelineSchema = SchemaFactory.createForClass(PipelineSchemaClass);
