import { GetStepByIdDTO } from '@/application/dtos/step/get-step-by-id.dto';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';

export class GetStepByIdUseCase {
  constructor(private readonly stepRepository: StepRepository) {}

  public async execute(request: GetStepByIdDTO): Promise<Step | null> {
    const { id } = request;

    const step = await this.stepRepository.existsById(id);

    return step;
  }
}
