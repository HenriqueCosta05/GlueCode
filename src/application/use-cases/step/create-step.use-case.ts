import { Inject, Injectable } from '@nestjs/common';
import { StepConfig } from '@/@types/domain';
import { CreateStepDTO } from '@/application/dtos/step/create-step.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { Step } from '@/domain/entities/step';
import { generateID } from '@/shared/utils/StringUtils';

@Injectable()
export class CreateStepUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: CreateStepDTO): Promise<boolean> {
    const { kind, config } = request;

    const id = generateID();

    const step = new Step(id, kind, config as unknown as StepConfig);

    const created = await this.stepRepository.createStep(step);

    return created;
  }
}
