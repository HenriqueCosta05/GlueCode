import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { SchemaAdapter } from '@/adapters/schema';
import { DomainExceptionFilter } from '@/presentation/common/domain-exception.filter';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsGateway } from './integrations.gateway';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@Module({
  imports: [PipelineModule],
  controllers: [IntegrationsController],
  providers: [
    SchemaAdapter,
    IntegrationEventsEmitter,
    IntegrationsGateway,
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
  exports: [IntegrationEventsEmitter, SchemaAdapter],
})
export class IntegrationsModule {}
