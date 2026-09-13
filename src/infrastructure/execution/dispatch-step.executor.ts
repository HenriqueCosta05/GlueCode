import { Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';

@Injectable()
export class DispatchStepExecutor implements StepExecutor {
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.DISPATCH) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    const { destination } = step.config;

    try {
      const response = await fetch(destination.url, {
        method: destination.method,
        headers: { 'Content-Type': 'application/json', ...destination.headers },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return new StepResult(step.id, 'FAILED', payload, new Date());
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const responseBody = await response.json().catch(() => payload);
      return new StepResult(step.id, 'SUCCESS', responseBody, new Date());
    } catch {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }
  }
}
