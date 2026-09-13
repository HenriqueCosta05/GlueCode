import { AuthSpec, EndpointSpec, FieldMapping } from '@/@types/domain';
import { ConnectorId } from '@/@types/IDs';
// import { Pipeline } from "./pipeline";
// import { generatePipelineId } from "@/infrastructure/utils/StringUtils";

export class ConnectorDefinition {
  constructor(
    readonly id: ConnectorId,
    readonly source: EndpointSpec,
    readonly mapping: FieldMapping[],
    readonly destination: EndpointSpec,
    readonly auth: AuthSpec,
  ) {}

  // toPipeline(): Pipeline {
  //   return new Pipeline(
  //     generatePipelineId() as PipelineId,
  //     [
  //       // Step 1: Receive data from source
  //     ]
  //   );
  // }
}
