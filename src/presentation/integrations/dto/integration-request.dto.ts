import { PipelineStatus, StepKind } from '@/@types/enums';
import { StepConfig } from '@/@types/domain';

export class StepRequestDto {
  id!: string;
  kind!: StepKind;
  config!: StepConfig;
}

export class CreateIntegrationRequestDto {
  name?: string;
  description?: string;
  status?: PipelineStatus;
  steps!: StepRequestDto[];
}

export class UpdateIntegrationRequestDto {
  name?: string;
  description?: string;
  status?: PipelineStatus;
  steps!: StepRequestDto[];
}
