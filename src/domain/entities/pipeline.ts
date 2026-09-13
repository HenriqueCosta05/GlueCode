import { PipelineId } from '@/@types/IDs';
import { Step } from './step';
import { PipelineStatus } from '@/@types/enums';
import { InvalidPipelineError } from '@/shared/errors/domain';
import { Entity } from '@/base/entity';

export class Pipeline extends Entity {
  constructor(
    public readonly id: PipelineId,
    private readonly steps: Step[],
    public status: PipelineStatus = PipelineStatus.IDLE,
  ) {
    if (steps.length === 0)
      throw new InvalidPipelineError('A pipeline must have at least one step.');
    super();
  }

  nextStep(currentIndex: number): Step | null {
    return this.steps[currentIndex + 1] ?? null;
  }

  markFailed(atStep: number, reason: string): void {
    console.error(`Pipeline ${this.id} failed at step ${atStep}: ${reason}`);
    this.status = PipelineStatus.FAILED;
    this.steps.slice(atStep).forEach((step) => {
      console.log(`Marking step ${step.id} as failed.`);
    });
  }

  markCompleted(): void {
    console.log(`Pipeline ${this.id} completed successfully.`);
    this.status = PipelineStatus.COMPLETED;
  }

  getCurrentStatus(): PipelineStatus {
    return this.status;
  }

  getCurrentStep(index: number): Step | null {
    if (index < 0 || index >= this.steps.length) {
      console.warn(`Invalid step index ${index} for pipeline ${this.id}.`);
      return null;
    }
    return this.steps[index];
  }
}
