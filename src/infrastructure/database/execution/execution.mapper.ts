import { Mapper } from '@/base/mapper';
import { Execution } from '@/domain/entities/execution';
import { ExecutionDocument, ExecutionSchemaClass } from './execution.schema';

export class ExecutionMapper extends Mapper<
  Partial<ExecutionSchemaClass>,
  Execution
> {
  mapFrom(input: ExecutionDocument): Execution {
    return new Execution(
      input._id,
      input.pipelineId,
      input.status,
      input.startedAt,
      input.completedAt,
    );
  }

  mapTo(input: Execution): Partial<ExecutionSchemaClass> {
    return {
      _id: input.id,
      pipelineId: input.pipelineId,
      status: input.status,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
    };
  }
}
