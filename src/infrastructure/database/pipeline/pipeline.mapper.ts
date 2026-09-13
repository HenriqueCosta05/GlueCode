import { Mapper } from '@/base/mapper';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';
import { PipelineDocument, PipelineSchemaClass } from './pipeline.schema';

export class PipelineMapper extends Mapper<
  Partial<PipelineSchemaClass>,
  Pipeline
> {
  mapFrom(input: PipelineDocument): Pipeline {
    const steps = input.steps.map(
      (step) => new Step(step._id, step.kind, step.config),
    );
    return new Pipeline(
      input._id,
      steps,
      input.status,
      input.name,
      input.description,
    );
  }

  mapTo(input: Pipeline): Partial<PipelineSchemaClass> {
    return {
      _id: input.id,
      steps: input.getSteps().map((step) => ({
        _id: step.id,
        kind: step.kind,
        config: step.config,
      })),
      status: input.status,
      name: input.name,
      description: input.description,
    };
  }
}
