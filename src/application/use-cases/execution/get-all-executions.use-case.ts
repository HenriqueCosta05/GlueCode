import { Inject, Injectable } from '@nestjs/common';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

@Injectable()
export class GetAllExecutionsUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(): Promise<Execution[]> {
    const executions = await this.executionRepository.getAllExecutions();

    return executions;
  }
}
