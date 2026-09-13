import { StepKind } from '@/@types/enums';
import { StepRepository } from '@/application/repositories/step.repository';
import { Step } from '@/domain/entities/step';
import { StepNotFoundError } from '@/shared/errors/domain';
import { DeleteStepUseCase } from './delete-step.use-case';

describe('DeleteStepUseCase', () => {
  it('throws StepNotFoundError when the step does not exist', async () => {
    const repository: jest.Mocked<StepRepository> = {
      createStep: jest.fn(),
      updateStep: jest.fn(),
      deleteStep: jest.fn(),
      existsById: jest.fn().mockResolvedValue(null),
      getAllSteps: jest.fn(),
    };
    const useCase = new DeleteStepUseCase(repository);

    await expect(useCase.execute({ id: 'missing' })).rejects.toBeInstanceOf(
      StepNotFoundError,
    );
  });

  it('deletes an existing step', async () => {
    const existing = new Step('s1', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'info',
    });
    const repository: jest.Mocked<StepRepository> = {
      createStep: jest.fn(),
      updateStep: jest.fn(),
      deleteStep: jest.fn().mockResolvedValue(true),
      existsById: jest.fn().mockResolvedValue(existing),
      getAllSteps: jest.fn(),
    };
    const useCase = new DeleteStepUseCase(repository);

    const result = await useCase.execute({ id: 's1' });

    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.deleteStep).toHaveBeenCalledWith(existing);
  });
});
