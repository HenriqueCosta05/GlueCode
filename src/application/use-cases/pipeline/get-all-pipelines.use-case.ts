import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';

export class GetAllPipelinesUseCase {
  constructor(private readonly pipelineRepository: PipelineRepository) {}

  public async execute(): Promise<Pipeline[]> {
    const pipelines = await this.pipelineRepository.getAllPipelines();

    return pipelines;
  }
}
