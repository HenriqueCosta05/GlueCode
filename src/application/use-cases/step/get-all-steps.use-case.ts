import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';

export class GetAllStepsUseCase {
  constructor(private readonly stepRepository: StepRepository) {}

  public async execute(): Promise<Step[]> {
    const steps = await this.stepRepository.getAllSteps();

    return steps;
  }
}
