import { DomainError } from '@/base/error';

export class InvalidPipelineError extends DomainError {
  readonly code = 'INVALID_PIPELINE';
}

export class InvalidStepTransitionError extends DomainError {
  readonly code = 'INVALID_STEP_TRANSITION';
}
