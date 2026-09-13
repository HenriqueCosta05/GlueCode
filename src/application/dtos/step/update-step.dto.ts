import { StepConfig } from '@/@types/domain';
import { StepKind } from '@/@types/enums';
import { StepId } from '@/@types/IDs';

export interface UpdateStepDTO {
  id: StepId;
  kind: StepKind;
  config: StepConfig;
}
