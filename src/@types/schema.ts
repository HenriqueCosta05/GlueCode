import { PipelineStatus, StepKind } from '@/@types/enums';
import { StepConfig } from '@/@types/domain';

export type PipelineJSON = {
  id: string;
  name?: string;
  description?: string;
  status: PipelineStatus;
  steps: { id: string; kind: StepKind; config: StepConfig }[];
};

export type Schema = {
  pipeline: PipelineJSON;
};
