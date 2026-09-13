import {
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
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

@WebSocketGateway({ namespace: 'integrations', cors: { origin: '*' } })
export class IntegrationsGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly createPipelineUseCase: CreatePipelineUseCase,
    private readonly updatePipelineUseCase: UpdatePipelineUseCase,
    private readonly deletePipelineUseCase: DeletePipelineUseCase,
    private readonly getPipelineByIdUseCase: GetPipelineByIdUseCase,
    private readonly getAllPipelinesUseCase: GetAllPipelinesUseCase,
    private readonly schemaAdapter: SchemaAdapter,
    private readonly events: IntegrationEventsEmitter,
  ) {}

  afterInit(): void {
    this.events.on('integration.created', (schema) =>
      this.server.emit('integration.created', schema),
    );
    this.events.on('integration.updated', (schema) =>
      this.server.emit('integration.updated', schema),
    );
    this.events.on('integration.deleted', (schema) =>
      this.server.emit('integration.deleted', schema),
    );
  }

  @SubscribeMessage('integration:create')
  async handleCreate(
    @MessageBody() body: CreateIntegrationRequestDto,
  ): Promise<Schema> {
    const pipeline = await this.createPipelineUseCase.execute({
      name: body.name,
      description: body.description,
      status: body.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new WsException('Failed to create integration');
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.created', schema);
    return schema;
  }

  @SubscribeMessage('integration:getAll')
  async handleGetAll(): Promise<Schema[]> {
    const pipelines = await this.getAllPipelinesUseCase.execute();
    return pipelines.map((pipeline) => this.schemaAdapter.toSchema(pipeline));
  }

  @SubscribeMessage('integration:getById')
  async handleGetById(@MessageBody() body: { id: string }): Promise<Schema> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id: body.id });
    if (!pipeline) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    return this.schemaAdapter.toSchema(pipeline);
  }

  @SubscribeMessage('integration:update')
  async handleUpdate(
    @MessageBody() body: { id: string } & UpdateIntegrationRequestDto,
  ): Promise<Schema> {
    const existing = await this.getPipelineByIdUseCase.execute({
      id: body.id,
    });
    if (!existing) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    const pipeline = await this.updatePipelineUseCase.execute({
      id: body.id,
      name: body.name,
      description: body.description,
      status: body.status ?? existing.status,
      steps: body.steps.map((s) => new Step(s.id, s.kind, s.config)),
    });
    if (!pipeline) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    const schema = this.schemaAdapter.toSchema(pipeline);
    this.events.emit('integration.updated', schema);
    return schema;
  }

  @SubscribeMessage('integration:delete')
  async handleDelete(
    @MessageBody() body: { id: string },
  ): Promise<{ id: string }> {
    const pipeline = await this.getPipelineByIdUseCase.execute({ id: body.id });
    if (!pipeline) {
      throw new WsException(`Integration ${body.id} not found`);
    }
    await this.deletePipelineUseCase.execute({ id: body.id });
    this.events.emit(
      'integration.deleted',
      this.schemaAdapter.toSchema(pipeline),
    );
    return { id: body.id };
  }
}
