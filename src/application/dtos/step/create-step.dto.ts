import { StepKind } from '@/@types/enums';

export interface CreateStepDTO {
  kind: StepKind;
  config: Record<string, unknown>; // Depende do tipo da etapa, por isso unknown
}
