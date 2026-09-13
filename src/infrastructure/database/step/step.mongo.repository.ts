import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { StepDocument, StepSchemaClass } from './step.schema';
import { StepMapper } from './step.mapper';

@Injectable()
export class StepMongoRepository implements StepRepository {
  private readonly mapper = new StepMapper();

  constructor(
    @InjectModel(StepSchemaClass.name)
    private readonly model: Model<StepDocument>,
  ) {}

  async createStep(step: Step): Promise<boolean> {
    try {
      await this.model.create(this.mapper.mapTo(step));
      return true;
    } catch {
      return false;
    }
  }

  async updateStep(step: Step): Promise<Step | null> {
    const doc = await this.model
      .findByIdAndUpdate(step.id, this.mapper.mapTo(step), { new: true })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deleteStep(step: Step): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: step.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(stepId: string): Promise<Step | null> {
    const doc = await this.model.findById(stepId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllSteps(): Promise<Step[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
