import { Inject, Injectable } from '@nestjs/common';
import { UpdatePipelineDTO } from '@/application/dtos/pipeline/update-pipeline.dto';
import type { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';

@Injectable()
export class UpdatePipelineUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: UpdatePipelineDTO): Promise<Pipeline | null> {
    const { id, steps, status, name, description } = request;

    const pipeline = new Pipeline(id, steps, status, name, description);

    const updated = await this.pipelineRepository.updatePipeline(pipeline);

    return updated;
  }
}
