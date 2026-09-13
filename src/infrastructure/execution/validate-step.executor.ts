import { Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';

@Injectable()
export class ValidateStepExecutor implements StepExecutor {
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.VALIDATE) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    const record = (payload ?? {}) as Record<string, unknown>;
    const missingKeys = Object.keys(step.config.schema).filter(
      (key) => !(key in record),
    );

    if (missingKeys.length > 0) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    return new StepResult(step.id, 'SUCCESS', payload, new Date());
  }
}
