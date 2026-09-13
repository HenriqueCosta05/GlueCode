import { Step, StepResult } from '@/domain/entities/step';

export interface StepExecutor {
  execute(step: Step, payload: unknown): Promise<StepResult>;
}
