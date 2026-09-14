import { Inject, Injectable } from '@nestjs/common';
import { DeleteStepDTO } from '@/application/dtos/step/delete-step.dto';
import type { StepRepository } from '@/application/repositories/step.repository';
import { STEP_REPOSITORY } from '@/application/tokens';
import { StepNotFoundError } from '@/shared/errors/domain';

@Injectable()
export class DeleteStepUseCase {
  constructor(
    @Inject(STEP_REPOSITORY) private readonly stepRepository: StepRepository,
  ) {}

  public async execute(request: DeleteStepDTO): Promise<boolean> {
    const { id } = request;

    const existingStep = await this.stepRepository.existsById(id);

    if (!existingStep) {
      throw new StepNotFoundError(`Step with id ${id} was not found.`);
    }

    const deleted = await this.stepRepository.deleteStep(existingStep);

    return deleted;
  }
}
