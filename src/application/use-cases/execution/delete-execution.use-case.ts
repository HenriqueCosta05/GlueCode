import { DeleteExecutionDTO } from '@/application/dtos/execution/delete-execution.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { ExecutionNotFoundError } from '@/shared/errors/domain';

export class DeleteExecutionUseCase {
  constructor(private readonly executionRepository: ExecutionRepository) {}

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
