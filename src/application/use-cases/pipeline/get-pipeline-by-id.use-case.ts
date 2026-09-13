import { GetPipelineByIdDTO } from '@/application/dtos/pipeline/get-pipeline-by-id.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';

export class GetPipelineByIdUseCase {
  constructor(private readonly pipelineRepository: PipelineRepository) {}

  public async execute(request: GetPipelineByIdDTO): Promise<Pipeline | null> {
    const { id } = request;

    const pipeline = await this.pipelineRepository.existsById(id);

    return pipeline;
  }
}
