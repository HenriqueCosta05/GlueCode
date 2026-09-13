import { Inject, Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GetExecutionByIdUseCase } from '@/application/use-cases/execution/get-execution-by-id.use-case';
import { UpdateExecutionUseCase } from '@/application/use-cases/execution/update-execution.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { LoggerPort } from '@/application/ports/logger.port';
import {
  LOGGER_PORT,
  PIPELINE_EXECUTION_QUEUE,
  STEP_EXECUTOR_REGISTRY,
} from '@/application/tokens';
import { StepExecutorRegistry } from '@/infrastructure/execution/step-executor.registry';

export type PipelineExecutionJobData = { executionId: string };

@Injectable()
@Processor(PIPELINE_EXECUTION_QUEUE)
export class PipelineExecutionProcessor extends WorkerHost {
  constructor(
    private readonly getExecutionById: GetExecutionByIdUseCase,
    private readonly updateExecution: UpdateExecutionUseCase,
    private readonly getPipelineById: GetPipelineByIdUseCase,
    @Inject(STEP_EXECUTOR_REGISTRY)
    private readonly executors: StepExecutorRegistry,
    @Inject(LOGGER_PORT) private readonly logger: LoggerPort,
  ) {
    super();
  }

  async process(job: Job<PipelineExecutionJobData>): Promise<void> {
    const execution = await this.getExecutionById.execute({
      id: job.data.executionId,
    });
    if (!execution) {
      throw new Error(`Execution ${job.data.executionId} not found`);
    }

    const pipeline = await this.getPipelineById.execute({
      id: execution.pipelineId,
    });
    if (!pipeline) {
      throw new Error(`Pipeline ${execution.pipelineId} not found`);
    }

    execution.updateExecutionStatus('RUNNING');
    await this.persist(execution);

    let payload: unknown = {};
    let index = 0;
    let step = pipeline.getCurrentStep(0);

    while (step) {
      const executor = this.executors[step.kind];
      const result = await executor.execute(step, payload);

      await this.logger.log(
        result.status === 'FAILED' ? 'error' : 'info',
        `Step ${step.id} (${step.kind}) ${result.status}`,
        undefined,
        execution.id,
      );

      if (result.status === 'FAILED') {
        pipeline.markFailed(index, `Step ${step.id} failed`);
        execution.updateExecutionStatus('FAILED');
        await this.persist(execution);
        return;
      }

      payload = result.payload;
      step = pipeline.nextStep(index);
      index += 1;
    }

    pipeline.markCompleted();
    execution.updateExecutionStatus('COMPLETED');
    await this.persist(execution);
  }

  private async persist(execution: {
    id: string;
    pipelineId: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    startedAt: Date;
    completedAt?: Date;
  }): Promise<void> {
    await this.updateExecution.execute({
      id: execution.id,
      pipelineId: execution.pipelineId,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
    });
  }
}
