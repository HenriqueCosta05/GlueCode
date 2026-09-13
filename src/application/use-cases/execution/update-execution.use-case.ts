import { Inject, Injectable } from '@nestjs/common';
import { UpdateExecutionDTO } from '@/application/dtos/execution/update-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

@Injectable()
export class UpdateExecutionUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(request: UpdateExecutionDTO): Promise<Execution | null> {
    const { id, pipelineId, status, startedAt, completedAt } = request;

    const execution = new Execution(
      id,
      pipelineId,
      status,
      startedAt,
      completedAt,
    );

    const updated = await this.executionRepository.updateExecution(execution);

    return updated;
  }
}
