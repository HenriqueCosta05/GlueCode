import { UpdateExecutionDTO } from '@/application/dtos/execution/update-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';

export class UpdateExecutionUseCase {
  constructor(private readonly executionRepository: ExecutionRepository) {}

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
