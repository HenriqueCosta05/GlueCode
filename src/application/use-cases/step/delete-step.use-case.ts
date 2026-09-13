import { DeleteStepDTO } from '@/application/dtos/step/delete-step.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { StepNotFoundError } from '@/shared/errors/domain';

export class DeleteStepUseCase {
  constructor(private readonly stepRepository: StepRepository) {}

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
