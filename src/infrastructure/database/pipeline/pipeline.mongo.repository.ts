import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Pipeline } from '@/domain/entities/pipeline';
import { PipelineDocument, PipelineSchemaClass } from './pipeline.schema';
import { PipelineMapper } from './pipeline.mapper';

@Injectable()
export class PipelineMongoRepository implements PipelineRepository {
  private readonly mapper = new PipelineMapper();

  constructor(
    @InjectModel(PipelineSchemaClass.name)
    private readonly model: Model<PipelineDocument>,
  ) {}

  async createPipeline(pipeline: Pipeline): Promise<boolean> {
    try {
      await this.model.create(this.mapper.mapTo(pipeline));
      return true;
    } catch {
      return false;
    }
  }

  async updatePipeline(pipeline: Pipeline): Promise<Pipeline | null> {
    const doc = await this.model
      .findByIdAndUpdate(pipeline.id, this.mapper.mapTo(pipeline), {
        new: true,
      })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deletePipeline(pipeline: Pipeline): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: pipeline.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(pipelineId: string): Promise<Pipeline | null> {
    const doc = await this.model.findById(pipelineId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllPipelines(): Promise<Pipeline[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
