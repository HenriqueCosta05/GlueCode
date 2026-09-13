import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Schema } from '@/@types/schema';
import { Step } from '@/domain/entities/step';
import { CreatePipelineUseCase } from '@/application/use-cases/pipeline/create-pipeline.use-case';
import { UpdatePipelineUseCase } from '@/application/use-cases/pipeline/update-pipeline.use-case';
import { DeletePipelineUseCase } from '@/application/use-cases/pipeline/delete-pipeline.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { GetAllPipelinesUseCase } from '@/application/use-cases/pipeline/get-all-pipelines.use-case';
import { SchemaAdapter } from '@/adapters/schema';
import {
  CreateIntegrationRequestDto,
  UpdateIntegrationRequestDto,
} from './dto/integration-request.dto';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly createPipelineUseCase: CreatePipelineUseCase,
    private readonly updatePipelineUseCase: UpdatePipelineUseCase,
    private readonly deletePipelineUseCase: DeletePipelineUseCase,
    private readonly getPipelineByIdUseCase: GetPipelineByIdUseCase,
    private readonly getAllPipelinesUseCase: GetAllPipelinesUseCase,
    private readonly schemaAdapter: SchemaAdapter,
    private readonly events: IntegrationEventsEmitter,
  ) {}

  @Post()
  async create(@Body() body: CreateIntegrationRequestDto): Promise<Schema> {
    const pipeline = await this.createPipelineUseCase.execute({
      name: body.name,
      description: body.description,
      status: body.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new InternalServerErrorException('Failed to create integration');
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.created', schema);
    return schema;
  }

  @Get()
  async findAll(): Promise<Schema[]> {
    const pipelines = await this.getAllPipelinesUseCase.execute();
    return pipelines.map((pipeline) => this.schemaAdapter.toSchema(pipeline));
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Schema> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id });
    if (!pipeline) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    return this.schemaAdapter.toSchema(pipeline);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateIntegrationRequestDto,
  ): Promise<Schema> {
    const existing = await this.getPipelineByIdUseCase.execute({ id });
    if (!existing) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    const pipeline = await this.updatePipelineUseCase.execute({
      id,
      name: body.name,
      description: body.description,
      status: body.status ?? existing.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.updated', schema);
    return schema;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id });
    if (!pipeline) {
      throw new NotFoundException(`Integration ${id} not found`);
    }
    await this.deletePipelineUseCase.execute({ id });
    this.events.emit(
      'integration.deleted',
      this.schemaAdapter.toSchema(pipeline),
    );
  }
}
