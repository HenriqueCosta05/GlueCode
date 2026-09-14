import { Inject, Injectable } from '@nestjs/common';
import { GetPipelineByIdDTO } from '@/application/dtos/pipeline/get-pipeline-by-id.dto';
import type { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';

@Injectable()
export class GetPipelineByIdUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(request: GetPipelineByIdDTO): Promise<Pipeline | null> {
    const { id } = request;

    const pipeline = await this.pipelineRepository.existsById(id);

    return pipeline;
  }
}
