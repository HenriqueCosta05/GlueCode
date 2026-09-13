import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { Execution } from '@/domain/entities/execution';
import { ExecutionDocument, ExecutionSchemaClass } from './execution.schema';
import { ExecutionMapper } from './execution.mapper';

@Injectable()
export class ExecutionMongoRepository implements ExecutionRepository {
  private readonly mapper = new ExecutionMapper();

  constructor(
    @InjectModel(ExecutionSchemaClass.name)
    private readonly model: Model<ExecutionDocument>,
  ) {}

  async createExecution(execution: Execution): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(execution));
    return true;
  }

  async updateExecution(execution: Execution): Promise<Execution | null> {
    const doc = await this.model
      .findByIdAndUpdate(execution.id, this.mapper.mapTo(execution), {
        new: true,
      })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deleteExecution(execution: Execution): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: execution.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(executionId: string): Promise<Execution | null> {
    const doc = await this.model.findById(executionId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllExecutions(): Promise<Execution[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
