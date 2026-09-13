import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PIPELINE_REPOSITORY } from '@/application/tokens';
import { CreatePipelineUseCase } from '@/application/use-cases/pipeline/create-pipeline.use-case';
import { UpdatePipelineUseCase } from '@/application/use-cases/pipeline/update-pipeline.use-case';
import { DeletePipelineUseCase } from '@/application/use-cases/pipeline/delete-pipeline.use-case';
import { GetPipelineByIdUseCase } from '@/application/use-cases/pipeline/get-pipeline-by-id.use-case';
import { GetAllPipelinesUseCase } from '@/application/use-cases/pipeline/get-all-pipelines.use-case';
import { PipelineSchema, PipelineSchemaClass } from './pipeline.schema';
import { PipelineMongoRepository } from './pipeline.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PipelineSchemaClass.name, schema: PipelineSchema },
    ]),
  ],
  providers: [
    { provide: PIPELINE_REPOSITORY, useClass: PipelineMongoRepository },
    CreatePipelineUseCase,
    UpdatePipelineUseCase,
    DeletePipelineUseCase,
    GetPipelineByIdUseCase,
    GetAllPipelinesUseCase,
  ],
  exports: [
    PIPELINE_REPOSITORY,
    CreatePipelineUseCase,
    UpdatePipelineUseCase,
    DeletePipelineUseCase,
    GetPipelineByIdUseCase,
    GetAllPipelinesUseCase,
  ],
})
export class PipelineModule {}
