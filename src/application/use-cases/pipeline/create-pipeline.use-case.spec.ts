import { StepKind, PipelineStatus } from '@/@types/enums';
import { PipelineRepository } from '@/application/repositories/pipeline.repository';
import { Step } from '@/domain/entities/step';
import { CreatePipelineUseCase } from './create-pipeline.use-case';

describe('CreatePipelineUseCase', () => {
  it('returns the created Pipeline entity', async () => {
    const repository: jest.Mocked<PipelineRepository> = {
      createPipeline: jest.fn().mockResolvedValue(true),
      updatePipeline: jest.fn(),
      deletePipeline: jest.fn(),
      existsById: jest.fn(),
      getAllPipelines: jest.fn(),
    };
    const useCase = new CreatePipelineUseCase(repository);
    const steps = [
      new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' }),
    ];

    const pipeline = await useCase.execute({
      steps,
      status: PipelineStatus.IDLE,
      name: 'My Pipeline',
    });

    expect(pipeline).not.toBeNull();
    expect(pipeline?.name).toBe('My Pipeline');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createPipeline).toHaveBeenCalledWith(pipeline);
  });

  it('returns null when the repository reports failure', async () => {
    const repository: jest.Mocked<PipelineRepository> = {
      createPipeline: jest.fn().mockResolvedValue(false),
      updatePipeline: jest.fn(),
      deletePipeline: jest.fn(),
      existsById: jest.fn(),
      getAllPipelines: jest.fn(),
    };
    const useCase = new CreatePipelineUseCase(repository);
    const steps = [
      new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' }),
    ];

    const pipeline = await useCase.execute({ steps });

    expect(pipeline).toBeNull();
  });
});
