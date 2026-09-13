import {
  AuthSpec,
  EndpointSpec,
  FieldMapping,
  JsonSchema,
} from '@/@types/domain';
import { ConnectorId, PipelineId } from '@/@types/IDs';
import { Pipeline } from './pipeline';
import { generateID } from '@/shared/utils/StringUtils';
import { Step } from './step';
import { StepKind } from '@/@types/enums';
import { Entity } from '@/base/entity';

export class Connector extends Entity {
  constructor(
    readonly id: ConnectorId,
    readonly source: EndpointSpec,
    readonly schema: JsonSchema,
    readonly mapping: FieldMapping[],
    readonly destination: EndpointSpec,
    readonly auth: AuthSpec,
  ) {
    super();
  }

  createPipeline(): Pipeline {
    const pipelineId: PipelineId = generateID();

    const steps: Step[] = [
      // RECEIVER
      new Step(`${pipelineId}-receive`, StepKind.RECEIVE, {
        source: this.source,
        kind: StepKind.RECEIVE,
      }),
      // VALIDATOR
      new Step(`${pipelineId}-validate`, StepKind.VALIDATE, {
        schema: this.schema,
        kind: StepKind.VALIDATE,
      }),
      // TRANSFORMER
      new Step(`${pipelineId}-transform`, StepKind.TRANSFORM, {
        mapping: this.mapping,
        kind: StepKind.TRANSFORM,
      }),
      // DISPATCHER
      new Step(`${pipelineId}-dispatch`, StepKind.DISPATCH, {
        destination: this.destination,
        kind: StepKind.DISPATCH,
        auth: this.auth,
      }),
      // LOGGER
      new Step(`${pipelineId}-log`, StepKind.LOG, {
        kind: StepKind.LOG,
        level: 'info',
      }),
    ];

    return new Pipeline(pipelineId, steps);
  }
}
