import { Pipeline } from '@/domain/entities/pipeline';

export interface PipelineRepository {
  createPipeline(pipeline: Pipeline): Promise<boolean>;
  updatePipeline(pipeline: Pipeline): Promise<Pipeline | null>;
  deletePipeline(pipeline: Pipeline): Promise<boolean>;
  existsById(pipelineId: string): Promise<Pipeline | null>;
  getAllPipelines(): Promise<Pipeline[]>;
}
