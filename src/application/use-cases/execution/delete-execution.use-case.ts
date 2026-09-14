import { Inject, Injectable } from '@nestjs/common';
import { DeleteExecutionDTO } from '@/application/dtos/execution/delete-execution.dto';
import type { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { ExecutionNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteExecutionUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(request: DeleteExecutionDTO): Promise<boolean> {
    const { id } = request;

    const existingExecution = await this.executionRepository.existsById(id);

    if (!existingExecution) {
      throw new ExecutionNotFoundError(
        `Execution with id ${id} was not found.`,
      );
    }

    const deleted =
      await this.executionRepository.deleteExecution(existingExecution);

    return deleted;
  }
}
