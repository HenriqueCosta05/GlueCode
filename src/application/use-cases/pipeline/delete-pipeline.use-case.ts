import { Inject, Injectable } from '@nestjs/common';
import { DeletePipelineDTO } from '@/application/dtos/pipeline/delete-pipeline.dto';
import type { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { PipelineNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeletePipelineUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: DeletePipelineDTO): Promise<boolean> {
    const { id } = request;

    const existingPipeline = await this.pipelineRepository.existsById(id);

    if (!existingPipeline) {
      throw new PipelineNotFoundError(`Pipeline with id ${id} was not found.`);
    }

    const deleted =
      await this.pipelineRepository.deletePipeline(existingPipeline);

    return deleted;
  }
}
