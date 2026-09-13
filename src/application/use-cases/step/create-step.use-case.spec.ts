import { StepKind } from '@/@types/enums';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { CreateStepUseCase } from './create-step.use-case';

describe('CreateStepUseCase', () => {
  it('builds a Step and delegates to the repository', async () => {
    const repository: jest.Mocked<StepRepository> = {
      createStep: jest.fn().mockResolvedValue(true),
      updateStep: jest.fn(),
      deleteStep: jest.fn(),
      existsById: jest.fn(),
      getAllSteps: jest.fn(),
    };
    const useCase = new CreateStepUseCase(repository);

    const created = await useCase.execute({
      kind: StepKind.LOG,
      config: { kind: StepKind.LOG, level: 'info' },
    });

    expect(created).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createStep).toHaveBeenCalledTimes(1);
    const [step] = (repository.createStep as jest.Mock).mock.calls[0] as [Step];
    expect(step.kind).toBe(StepKind.LOG);
  });
});
