import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';

export class GetAllExecutionsUseCase {
  constructor(private readonly executionRepository: ExecutionRepository) {}

  public async execute(): Promise<Execution[]> {
    const executions = await this.executionRepository.getAllExecutions();

    return executions;
  }
}
