import { Injectable } from '@nestjs/common';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';

@Injectable()
export class ReceiveStepExecutor implements StepExecutor {
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    return new StepResult(step.id, 'SUCCESS', payload, new Date());
  }
}
