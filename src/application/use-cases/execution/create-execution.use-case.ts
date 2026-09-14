import { Inject, Injectable } from '@nestjs/common';
import { CreateExecutionDTO } from '@/application/dtos/execution/create-execution.dto';
import type { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';
import { generateID } from '@/shared/utils/StringUtils';

@Injectable()
export class CreateExecutionUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(request: CreateExecutionDTO): Promise<Execution | null> {
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

    return created ? execution : null;
  }
}
