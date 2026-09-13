import { UpdatePipelineDTO } from '@/application/dtos/pipeline/update-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';

export class UpdatePipelineUseCase {
  constructor(private readonly pipelineRepository: PipelineRepository) {}

  public async execute(request: UpdatePipelineDTO): Promise<Pipeline | null> {
    const { id, steps, status } = request;

    const pipeline = new Pipeline(id, steps, status);

    const updated = await this.pipelineRepository.updatePipeline(pipeline);

    return updated;
  }
}
