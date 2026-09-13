import { Injectable } from '@nestjs/common';
import { StepKind } from '@/@types/enums';
import { FieldMapping } from '@/@types/domain';
import { Step, StepResult } from '@/domain/entities/step';
import { StepExecutor } from './step-executor';
import { getByPath, setByPath } from './json-path.util';

function applyTransform(
  value: unknown,
  transform?: FieldMapping['transform'],
): unknown {
  if (transform === 'toUpperCase' && typeof value === 'string') {
    return value.toUpperCase();
  }
  if (
    transform === 'toISODate' &&
    (typeof value === 'string' || value instanceof Date)
  ) {
    return new Date(value).toISOString();
  }
  return value;
}

@Injectable()
export class TransformStepExecutor implements StepExecutor {
  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(step: Step, payload: unknown): Promise<StepResult> {
    if (step.config.kind !== StepKind.TRANSFORM) {
      return new StepResult(step.id, 'FAILED', payload, new Date());
    }

    const source = (payload ?? {}) as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    for (const mapping of step.config.mapping) {
      const value = getByPath(source, mapping.sourcePath);
      setByPath(
        target,
        mapping.targetPath,
        applyTransform(value, mapping.transform),
      );
    }

    return new StepResult(step.id, 'SUCCESS', target, new Date());
  }
}
