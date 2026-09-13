import { PipelineStatus } from '@/@types/enums';
import { PipelineId } from '@/@types/IDs';
import { Step } from '@/domain/entities/step';

export interface UpdatePipelineDTO {
  id: PipelineId;
  steps: Step[];
  status?: PipelineStatus;
}
