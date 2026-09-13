import { CreatePipelineDTO } from '@/application/dtos/pipeline/create-pipeline.dto';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';
import { generateID } from '@/infrastructure/utils/StringUtils';

export class CreatePipelineUseCase {
  constructor(private readonly pipelineRepository: PipelineRepository) {}

  public async execute(request: CreatePipelineDTO): Promise<boolean> {
    const { steps, status } = request;

    const id = generateID();

    const pipeline = new Pipeline(id, steps, status);

    const created = await this.pipelineRepository.createPipeline(pipeline);

    return created;
  }
}
