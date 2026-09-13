export type PipelineId = string & { readonly __brand: 'PipelineId' };
export type StepId = string & { readonly __brand: 'StepId' };
export type ExecutionId = string & { readonly __brand: 'ExecutionId' };
export type ConnectorId = string & { readonly __brand: 'ConnectorId' };

export const PipelineId = (v: string): PipelineId => v as PipelineId;
export const StepId = (v: string): StepId => v as StepId;
export const ExecutionId = (v: string): ExecutionId => v as ExecutionId;
export const ConnectorId = (v: string): ConnectorId => v as ConnectorId;
