import { Inject, Injectable } from '@nestjs/common';
import { GetExecutionByIdDTO } from '@/application/dtos/execution/get-execution-by-id.dto';
import type { ExecutionRepository } from '@/application/repositories/execution.repository';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

@Injectable()
export class GetExecutionByIdUseCase {
  constructor(
    @Inject(EXECUTION_REPOSITORY)
    private readonly executionRepository: ExecutionRepository,
  ) {}

  public async execute(
    request: GetExecutionByIdDTO,
  ): Promise<Execution | null> {
    const { id } = request;

    const execution = await this.executionRepository.existsById(id);

    return execution;
  }
}
