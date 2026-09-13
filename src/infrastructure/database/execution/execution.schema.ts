import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

@Schema({ collection: 'executions', timestamps: true, _id: false })
export class ExecutionSchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, required: true })
  pipelineId: string;

  @Prop({
    type: String,
    enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED'],
    required: true,
  })
  status: ExecutionStatus;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date })
  completedAt?: Date;
}

export type ExecutionDocument = HydratedDocument<ExecutionSchemaClass>;
export const ExecutionSchema =
  SchemaFactory.createForClass(ExecutionSchemaClass);
