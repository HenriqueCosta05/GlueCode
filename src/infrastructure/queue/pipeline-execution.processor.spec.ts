import { Job } from 'bullmq';
import { StepKind, PipelineStatus } from '@/@types/enums';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step, StepResult } from '@/domain/entities/step';
import { Execution } from '@/domain/entities/execution';
import { UpdateExecutionDTO } from '@/application/dtos/execution/update-execution.dto';
import { StepExecutor } from '@/infrastructure/execution/step-executor';
import { StepExecutorRegistry } from '@/infrastructure/execution/step-executor.registry';
import {
  PipelineExecutionJobData,
  PipelineExecutionProcessor,
} from './pipeline-execution.processor';

function buildProcessor(overrides: {
  pipeline: Pipeline;
  execution: Execution;
  executors: StepExecutorRegistry;
}) {
  const getExecutionById = {
    execute: jest.fn().mockResolvedValue(overrides.execution),
  };
  const updateExecution = {
    execute: jest
      .fn<Promise<Execution | null>, [UpdateExecutionDTO]>()
      .mockResolvedValue(overrides.execution),
  };
  const getPipelineById = {
    execute: jest.fn().mockResolvedValue(overrides.pipeline),
  };
  const logger = { log: jest.fn().mockResolvedValue(undefined) };

  const processor = new PipelineExecutionProcessor(
    getExecutionById as any,
    updateExecution as any,
    getPipelineById as any,
    overrides.executors,
    logger,
  );

  return { processor, updateExecution, logger };
}

describe('PipelineExecutionProcessor', () => {
  const step = new Step('s1', StepKind.LOG, {
    kind: StepKind.LOG,
    level: 'info',
  });
  const pipeline = new Pipeline('p1', [step], PipelineStatus.IDLE);
  const execution = new Execution(
    'e1',
    'p1',
    'PENDING',
    new Date('2026-01-01T00:00:00.000Z'),
  );

  it('marks the execution COMPLETED when every step succeeds', async () => {
    const succeeding: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s1', 'SUCCESS', {}, new Date())),
    };
    const { processor, updateExecution } = buildProcessor({
      pipeline,
      execution,
      executors: { [StepKind.LOG]: succeeding } as StepExecutorRegistry,
    });

    await processor.process({
      data: { executionId: 'e1' },
    } as Job<PipelineExecutionJobData>);

    const finalCall = updateExecution.execute.mock.calls.at(-1)?.[0];
    expect(finalCall?.status).toBe('COMPLETED');
  });

  it('marks the execution FAILED when a step fails', async () => {
    const failing: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s1', 'FAILED', {}, new Date())),
    };
    const { processor, updateExecution } = buildProcessor({
      pipeline,
      execution,
      executors: { [StepKind.LOG]: failing } as StepExecutorRegistry,
    });

    await processor.process({
      data: { executionId: 'e1' },
    } as Job<PipelineExecutionJobData>);

    const finalCall = updateExecution.execute.mock.calls.at(-1)?.[0];
    expect(finalCall?.status).toBe('FAILED');
  });
});
