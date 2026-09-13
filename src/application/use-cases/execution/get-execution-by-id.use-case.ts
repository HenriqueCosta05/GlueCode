import { GetExecutionByIdDTO } from '@/application/dtos/execution/get-execution-by-id.dto';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';

export class GetExecutionByIdUseCase {
  constructor(private readonly executionRepository: ExecutionRepository) {}

  public async execute(
    request: GetExecutionByIdDTO,
  ): Promise<Execution | null> {
    const { id } = request;

    const execution = await this.executionRepository.existsById(id);

    return execution;
  }
}
