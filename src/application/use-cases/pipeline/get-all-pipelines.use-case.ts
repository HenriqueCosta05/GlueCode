import { Inject, Injectable } from '@nestjs/common';
import type { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { Pipeline } from '@/domain/entities/pipeline';

@Injectable()
export class GetAllPipelinesUseCase {
  constructor(
    @Inject(PIPELINE_REPOSITORY)
    private readonly pipelineRepository: PipelineRepository,
  ) {}

  public async execute(): Promise<Pipeline[]> {
    const pipelines = await this.pipelineRepository.getAllPipelines();

    return pipelines;
  }
}
