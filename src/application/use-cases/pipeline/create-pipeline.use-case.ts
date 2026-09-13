import { Inject, Injectable } from '@nestjs/common';
import { CreatePipelineDTO } from '@/application/dtos/pipeline/create-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';
import { generateID } from '@/shared/utils/StringUtils';

@Injectable()
export class CreatePipelineUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: CreatePipelineDTO): Promise<Pipeline | null> {
    const { steps, status, name, description } = request;

    const id = generateID();

    const pipeline = new Pipeline(id, steps, status, name, description);

    const created = await this.pipelineRepository.createPipeline(pipeline);

    return created ? pipeline : null;
  }
}
