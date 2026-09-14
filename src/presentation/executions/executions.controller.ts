import {
  Body,
  Controller,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsString } from 'class-validator';
import { CreateExecutionUseCase } from '@/application/use-cases/execution/create-execution.use-case';
import { GetExecutionByIdUseCase } from '@/application/use-cases/execution/get-execution-by-id.use-case';
import { GetAllExecutionsUseCase } from '@/application/use-cases/execution/get-all-executions.use-case';
import { PIPELINE_EXECUTION_QUEUE } from '@/application/tokens';
import { Execution } from '@/domain/entities/execution';

export class CreateExecutionRequestDto {
  @IsString()
  pipelineId!: string;
}

@Controller('executions')
export class ExecutionsController {
  constructor(
    private readonly createExecutionUseCase: CreateExecutionUseCase,
    private readonly getExecutionByIdUseCase: GetExecutionByIdUseCase,
    private readonly getAllExecutionsUseCase: GetAllExecutionsUseCase,
    @InjectQueue(PIPELINE_EXECUTION_QUEUE) private readonly queue: Queue,
  ) {}

  @Post()
  @HttpCode(202)
  async create(@Body() body: CreateExecutionRequestDto): Promise<Execution> {
    const execution = await this.createExecutionUseCase.execute({
      pipelineId: body.pipelineId,
      status: 'PENDING',
      startedAt: new Date(),
    });
    if (!execution) {
      throw new InternalServerErrorException('Failed to create execution');
    }
    await this.queue.add(PIPELINE_EXECUTION_QUEUE, {
      executionId: execution.id,
    });
    return execution;
  }

  @Get()
  async findAll(): Promise<Execution[]> {
    return this.getAllExecutionsUseCase.execute();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Execution> {
    const execution = await this.getExecutionByIdUseCase.execute({ id });
    if (!execution) {
      throw new NotFoundException(`Execution ${id} not found`);
    }
    return execution;
  }
}
