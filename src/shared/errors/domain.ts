import { DomainError } from '@/base/error';

export class InvalidPipelineError extends DomainError {
  readonly code = 'INVALID_PIPELINE';
}

export class InvalidStepTransitionError extends DomainError {
  readonly code = 'INVALID_STEP_TRANSITION';
}

export class StepNotFoundError extends DomainError {
  readonly code = 'STEP_NOT_FOUND';
}

export class PipelineNotFoundError extends DomainError {
  readonly code = 'PIPELINE_NOT_FOUND';
}

export class ConnectorNotFoundError extends DomainError {
  readonly code = 'CONNECTOR_NOT_FOUND';
}

export class ExecutionNotFoundError extends DomainError {
  readonly code = 'EXECUTION_NOT_FOUND';
}

export class LogEntryNotFoundError extends DomainError {
  readonly code = 'LOG_ENTRY_NOT_FOUND';
}
