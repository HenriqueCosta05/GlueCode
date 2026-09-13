import { ExecutionId, PipelineId } from '@/@types/IDs';
import { Entity } from '@/base/entity';

export class Execution extends Entity {
  constructor(
    readonly id: ExecutionId,
    readonly pipelineId: PipelineId,
    public status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
    readonly startedAt: Date,
    public completedAt?: Date,
  ) {
    super();
  }

  updateExecutionStatus(
    newStatus: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
    completedAt?: Date,
  ): void {
    this.status = newStatus;
    if (newStatus === 'COMPLETED' || newStatus === 'FAILED') {
      this.completedAt = completedAt ?? new Date();
    }
  }

  toJSON() {
    return {
      id: this.id,
      pipelineId: this.pipelineId,
      status: this.status,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
    };
  }
}
