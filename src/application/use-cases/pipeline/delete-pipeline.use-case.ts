import { DeletePipelineDTO } from '@/application/dtos/pipeline/delete-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PipelineNotFoundError } from '@/shared/errors/domain';

export class DeletePipelineUseCase {
  constructor(private readonly pipelineRepository: PipelineRepository) {}

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
