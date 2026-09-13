import { Execution } from '@/domain/entities/execution';

export interface ExecutionRepository {
  createExecution(execution: Execution): Promise<boolean>;
  updateExecution(execution: Execution): Promise<Execution | null>;
  deleteExecution(execution: Execution): Promise<boolean>;
  existsById(executionId: string): Promise<Execution | null>;
  getAllExecutions(): Promise<Execution[]>;
}
