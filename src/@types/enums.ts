export enum StepKind {
  RECEIVE = 'RECEIVE',
  VALIDATE = 'VALIDATE',
  TRANSFORM = 'TRANSFORM',
  DISPATCH = 'DISPATCH',
  LOG = 'LOG',
}

export enum PipelineStatus {
  IDLE = 'IDLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export type StepResultStatus = 'SUCCESS' | 'FAILED';
