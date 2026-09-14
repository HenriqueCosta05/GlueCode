import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { LogLevel } from '@/domain/entities/log-entry';

@Schema({ collection: 'logs', timestamps: true, _id: false })
export class LogEntrySchemaClass {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ type: String, enum: ['info', 'warn', 'error'], required: true })
  level: LogLevel;

  @Prop({ type: String, required: true })
  message: string;

  @Prop({ type: Object })
  context?: Record<string, unknown>;

  @Prop({ type: String })
  executionId?: string;
}

export type LogEntryDocument = HydratedDocument<LogEntrySchemaClass>;
export const LogEntrySchema = SchemaFactory.createForClass(LogEntrySchemaClass);
