import { Injectable } from '@nestjs/common';
import { Schema } from '@/@types/schema';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';

export type PipelineInput = {
  name?: string;
  description?: string;
  steps: Step[];
};

@Injectable()
export class SchemaAdapter {
  toSchema(pipeline: Pipeline): Schema {
    return {
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        description: pipeline.description,
        status: pipeline.status,
        steps: pipeline.getSteps().map((step) => ({
          id: step.id,
          kind: step.kind,
          config: step.config,
        })),
      },
    };
  }

  toPipelineInput(schema: Schema): PipelineInput {
    return {
      name: schema.pipeline.name,
      description: schema.pipeline.description,
      steps: schema.pipeline.steps.map(
        (step) => new Step(step.id, step.kind, step.config),
      ),
    };
  }
}
