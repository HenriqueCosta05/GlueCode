// import { PipelineId } from "@/@types/IDs";
import { Step } from './step';
// import { PipelineStatus } from "@/@types/enums";
import { InvalidPipelineError } from '@/shared/errors/domain';

export class Pipeline {
  constructor(
    // private readonly id: PipelineId,
    private readonly steps: Step[],
    // private status: PipelineStatus = PipelineStatus.IDLE
  ) {
    if (steps.length === 0)
      throw new InvalidPipelineError('A pipeline must have at least one step.');
  }

  nextStep(currentIndex: number): Step | null {
    return this.steps[currentIndex + 1] ?? null;
  }

  // markFailed(atStep: number, reason: string): void { /* invariante: só falha se IN_PROGRESS */ }
  markCompleted(): void {
    /* invariante: só completa se todos os steps rodaram */
  }
}
