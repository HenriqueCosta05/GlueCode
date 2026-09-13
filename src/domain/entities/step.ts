import { StepConfig } from '@/@types/domain';
import { StepKind } from '@/@types/enums';
import { StepId } from '@/@types/IDs';
import { Entity } from '@/base/entity';
import { DomainError } from '@/base/error';

export class Step extends Entity {
  constructor(
    readonly id: StepId,
    readonly kind: StepKind, // RECEIVE | VALIDATE | TRANSFORM | DISPATCH | LOG
    readonly config: StepConfig,
  ) {
    super();
  }
}

export class StepResult {
  constructor(
    readonly stepId: StepId,
    readonly status: 'SUCCESS' | 'FAILED',
    readonly payload: unknown,
    readonly executedAt: Date,
    readonly error?: DomainError,
  ) {}
}
