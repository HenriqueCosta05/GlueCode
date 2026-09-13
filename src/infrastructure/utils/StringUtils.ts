import { ConnectorId, ExecutionId, PipelineId, StepId } from '@/@types/IDs';

export const generateID = (): string => {
  return crypto.randomUUID();
};

export const generateStepId = (): string => {
  return `step-${generateID()}` as StepId;
};

export const generateExecutionId = (): string => {
  return `execution-${generateID()}` as ExecutionId;
};

export const generateConnectorId = (): string => {
  return `connector-${generateID()}` as ConnectorId;
};

export const generatePipelineId = (): string => {
  return `pipeline-${generateID()}` as PipelineId;
};
