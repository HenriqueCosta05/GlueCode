import { Inject, Injectable } from '@nestjs/common';
import { UpdateStepDTO } from '@/application/dtos/step/update-step.dto';
import type { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';

@Injectable()
export class UpdateStepUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: UpdateStepDTO): Promise<Step | null> {
    const { id, kind, config } = request;

    const step = new Step(id, kind, config);

    const updated = await this.stepRepository.updateStep(step);

    return updated;
  }
}
