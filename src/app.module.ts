import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { StepModule } from './infrastructure/database/step/step.module';
import { PipelineModule } from './infrastructure/database/pipeline/pipeline.module';
import { ConnectorModule } from './infrastructure/database/connector/connector.module';
import { ExecutionModule } from './infrastructure/database/execution/execution.module';
import { LogEntryModule } from './infrastructure/database/log-entry/log-entry.module';
import { PipelineExecutionModule } from './infrastructure/queue/pipeline-execution.module';
import { IntegrationsModule } from './presentation/integrations/integrations.module';
import { LogsModule } from './presentation/logs/logs.module';
import { ExecutionsModule } from './presentation/executions/executions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    StepModule,
    PipelineModule,
    ConnectorModule,
    ExecutionModule,
    LogEntryModule,
    PipelineExecutionModule,
    IntegrationsModule,
    LogsModule,
    ExecutionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
