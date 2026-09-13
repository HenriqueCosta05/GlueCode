import { PipelineId } from '@/@types/IDs';

export interface CreateExecutionDTO {
  pipelineId: PipelineId;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
}
