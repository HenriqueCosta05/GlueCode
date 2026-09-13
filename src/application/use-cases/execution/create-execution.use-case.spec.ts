import { ExecutionRepository } from '@/application/repositories/execution.repository';
import { CreateExecutionUseCase } from './create-execution.use-case';

describe('CreateExecutionUseCase', () => {
  it('returns the created Execution entity', async () => {
    const repository: jest.Mocked<ExecutionRepository> = {
      createExecution: jest.fn().mockResolvedValue(true),
      updateExecution: jest.fn(),
      deleteExecution: jest.fn(),
      existsById: jest.fn(),
      getAllExecutions: jest.fn(),
    };
    const useCase = new CreateExecutionUseCase(repository);
    const startedAt = new Date('2026-01-01T00:00:00.000Z');

    const execution = await useCase.execute({
      pipelineId: 'p1',
      status: 'PENDING',
      startedAt,
    });

    expect(execution).not.toBeNull();
    expect(execution?.pipelineId).toBe('p1');
    expect(execution?.status).toBe('PENDING');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(repository.createExecution as jest.Mock).toHaveBeenCalledWith(
      execution,
    );
  });

  it('returns null when the repository reports failure', async () => {
    const repository: jest.Mocked<ExecutionRepository> = {
      createExecution: jest.fn().mockResolvedValue(false),
      updateExecution: jest.fn(),
      deleteExecution: jest.fn(),
      existsById: jest.fn(),
      getAllExecutions: jest.fn(),
    };
    const useCase = new CreateExecutionUseCase(repository);

    const execution = await useCase.execute({
      pipelineId: 'p1',
      status: 'PENDING',
      startedAt: new Date(),
    });

    expect(execution).toBeNull();
  });
});
