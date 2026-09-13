import { ExecutionId, PipelineId } from '@/@types/IDs';

export interface UpdateExecutionDTO {
  id: ExecutionId;
  pipelineId: PipelineId;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: Date;
  completedAt?: Date;
}
