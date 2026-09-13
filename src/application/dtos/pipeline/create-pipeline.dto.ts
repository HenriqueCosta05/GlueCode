import { PipelineStatus } from '@/@types/enums';
import { Step } from '@/domain/entities/step';

export interface CreatePipelineDTO {
  steps: Step[];
  status?: PipelineStatus;
}
