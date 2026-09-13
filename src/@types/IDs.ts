export type PipelineId = string;
export type StepId = string;
export type ExecutionId = string;
export type ConnectorId = string;
export type LogEntryId = string;

export const PipelineId = (v: string): PipelineId => v;
export const StepId = (v: string): StepId => v;
export const ExecutionId = (v: string): ExecutionId => v;
export const ConnectorId = (v: string): ConnectorId => v;
export const LogEntryId = (v: string): LogEntryId => v;
