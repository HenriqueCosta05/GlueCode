import { Step } from '@/domain/entities/step';

export interface StepRepository {
  createStep(step: Step): Promise<boolean>;
  updateStep(step: Step): Promise<Step | null>;
  deleteStep(step: Step): Promise<boolean>;
  existsById(stepId: string): Promise<Step | null>;
  getAllSteps(): Promise<Step[]>;
}
