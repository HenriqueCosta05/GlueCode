import { Module } from '@nestjs/common';
import { PipelineModule } from '@/infrastructure/database/pipeline/pipeline.module';
import { SchemaAdapter } from '@/adapters/schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationEventsEmitter } from './integration-events.emitter';

@Module({
  imports: [PipelineModule],
  controllers: [IntegrationsController],
  providers: [SchemaAdapter, IntegrationEventsEmitter],
  exports: [IntegrationEventsEmitter, SchemaAdapter],
})
export class IntegrationsModule {}
