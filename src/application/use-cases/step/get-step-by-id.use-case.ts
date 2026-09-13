import { Inject, Injectable } from '@nestjs/common';
import { GetStepByIdDTO } from '@/application/dtos/step/get-step-by-id.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';

@Injectable()
export class GetStepByIdUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: GetStepByIdDTO): Promise<Step | null> {
    const { id } = request;

    const step = await this.stepRepository.existsById(id);

    return step;
  }
}
