import { Inject, Injectable } from '@nestjs/common';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';

@Injectable()
export class GetAllStepsUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(): Promise<Step[]> {
    const steps = await this.stepRepository.getAllSteps();

    return steps;
  }
}
