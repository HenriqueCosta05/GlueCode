import { Inject, Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { Step, StepResult } from '@/domain/entities/step';
import type { LoggerPort } from '@/application/ports/logger.port';
import { LOGGER_PORT } from '@/application/tokens';
import { StepExecutor } from './step-executor';

@Injectable()
export class LogStepExecutor implements StepExecutor {
  constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.LOG) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    await this.logger.log(
      step.config.level === 'error' ? 'error' : 'info',
      `Step ${step.id} executed`,
      { payload },
    );

    return new StepResult(step.id, 'SUCCESS', payload, new Date());
  }
}
