import { Mapper } from '@/base/mapper';
import { Step } from '@/domain/entities/step';
import { StepDocument, StepSchemaClass } from './step.schema';

export class StepMapper extends Mapper<Partial<StepSchemaClass>, Step> {
  mapFrom(input: StepDocument): Step {
    return new Step(input._id, input.kind, input.config);
  }

  mapTo(input: Step): Partial<StepSchemaClass> {
    return {
      _id: input.id,
      kind: input.kind,
      config: input.config,
    };
  }
}
