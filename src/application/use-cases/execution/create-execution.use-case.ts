import { CreateExecutionDTO } from '@/application/dtos/execution/create-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';
import { generateID } from '@/infrastructure/utils/StringUtils';

export class CreateExecutionUseCase {
  constructor(private readonly executionRepository: ExecutionRepository) {}

  public async execute(request: CreateExecutionDTO): Promise<boolean> {
    const { pipelineId, status, startedAt, completedAt } = request;

    const id = generateID();

    const execution = new Execution(
      id,
      pipelineId,
      status,
      startedAt,
      completedAt,
    );

    const created = await this.executionRepository.createExecution(execution);

    return created;
  }
}
