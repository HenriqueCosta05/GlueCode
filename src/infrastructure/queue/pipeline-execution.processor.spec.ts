import { Job } from 'bullmq';
import { StepKind, PipelineStatus } from '@/@types/enums';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step, StepResult } from '@/domain/entities/step';
import { Execution } from '@/domain/entities/execution';
import { UpdateExecutionDTO } from '@/application/dtos/execution/update-execution.dto';
import { UpdatePipelineDTO } from '@/application/dtos/pipeline/update-pipeline.dto';
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
  const updatePipeline = {
    execute: jest
      .fn<Promise<Pipeline | null>, [UpdatePipelineDTO]>()
      .mockResolvedValue(overrides.pipeline),
  };
  const logger = { log: jest.fn().mockResolvedValue(undefined) };

  const processor = new PipelineExecutionProcessor(
    getExecutionById as any,
    updateExecution as any,
    getPipelineById as any,
    updatePipeline as any,
    overrides.executors,
    logger,
  );

  return { processor, updateExecution, updatePipeline, logger };
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
    const { processor, updateExecution, updatePipeline } = buildProcessor({
      pipeline,
      execution,
      executors: { [StepKind.LOG]: succeeding } as StepExecutorRegistry,
    });

    await processor.process({
      data: { executionId: 'e1' },
    } as Job<PipelineExecutionJobData>);

    const finalCall = updateExecution.execute.mock.calls.at(-1)?.[0];
    expect(finalCall?.status).toBe('COMPLETED');

    const pipelineCall = updatePipeline.execute.mock.calls.at(-1)?.[0];
    expect(pipelineCall).toMatchObject({
      id: 'p1',
      status: PipelineStatus.COMPLETED,
    });
  });

  it('marks the execution FAILED when a step fails', async () => {
    const failing: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s1', 'FAILED', {}, new Date())),
    };
    const { processor, updateExecution, updatePipeline } = buildProcessor({
      pipeline,
      execution,
      executors: { [StepKind.LOG]: failing } as StepExecutorRegistry,
    });

    await processor.process({
      data: { executionId: 'e1' },
    } as Job<PipelineExecutionJobData>);

    const finalCall = updateExecution.execute.mock.calls.at(-1)?.[0];
    expect(finalCall?.status).toBe('FAILED');

    const pipelineCall = updatePipeline.execute.mock.calls.at(-1)?.[0];
    expect(pipelineCall).toMatchObject({
      id: 'p1',
      status: PipelineStatus.FAILED,
    });
  });

  it('threads payload through a multi-step pipeline and stops at the failing step', async () => {
    const receiveStep = new Step('s1', StepKind.RECEIVE, {
      kind: StepKind.RECEIVE,
      source: { url: 'https://example.com', method: 'GET' },
    } as any);
    const transformStep = new Step('s2', StepKind.TRANSFORM, {
      kind: StepKind.TRANSFORM,
      mapping: [],
    } as any);
    const logStep = new Step('s3', StepKind.LOG, {
      kind: StepKind.LOG,
      level: 'info',
    });
    const multiStepPipeline = new Pipeline(
      'p1',
      [receiveStep, transformStep, logStep],
      PipelineStatus.IDLE,
    );

    const receiveExecutor: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(
          new StepResult('s1', 'SUCCESS', { fromReceive: true }, new Date()),
        ),
    };
    const transformExecutor: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s2', 'FAILED', {}, new Date())),
    };
    const logExecutor: StepExecutor = {
      execute: jest
        .fn()
        .mockResolvedValue(new StepResult('s3', 'SUCCESS', {}, new Date())),
    };

    const { processor, updateExecution, updatePipeline } = buildProcessor({
      pipeline: multiStepPipeline,
      execution,
      executors: {
        [StepKind.RECEIVE]: receiveExecutor,
        [StepKind.TRANSFORM]: transformExecutor,
        [StepKind.LOG]: logExecutor,
      } as StepExecutorRegistry,
    });

    await processor.process({
      data: { executionId: 'e1' },
    } as Job<PipelineExecutionJobData>);

    /* eslint-disable @typescript-eslint/unbound-method */
    expect(receiveExecutor.execute).toHaveBeenCalledWith(receiveStep, {});
    expect(transformExecutor.execute).toHaveBeenCalledWith(transformStep, {
      fromReceive: true,
    });
    expect(logExecutor.execute).not.toHaveBeenCalled();
    /* eslint-enable @typescript-eslint/unbound-method */

    const finalCall = updateExecution.execute.mock.calls.at(-1)?.[0];
    expect(finalCall?.status).toBe('FAILED');

    const pipelineCall = updatePipeline.execute.mock.calls.at(-1)?.[0];
    expect(pipelineCall).toMatchObject({
      id: 'p1',
      status: PipelineStatus.FAILED,
    });
  });
});
