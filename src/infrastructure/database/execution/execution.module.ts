import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EXECUTION_REPOSITORY } from '@/application/tokens';
import { CreateExecutionUseCase } from '@/application/use-cases/execution/create-execution.use-case';
import { UpdateExecutionUseCase } from '@/application/use-cases/execution/update-execution.use-case';
import { DeleteExecutionUseCase } from '@/application/use-cases/execution/delete-execution.use-case';
import { GetExecutionByIdUseCase } from '@/application/use-cases/execution/get-execution-by-id.use-case';
import { GetAllExecutionsUseCase } from '@/application/use-cases/execution/get-all-executions.use-case';
import { ExecutionSchema, ExecutionSchemaClass } from './execution.schema';
import { ExecutionMongoRepository } from './execution.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExecutionSchemaClass.name, schema: ExecutionSchema },
    ]),
  ],
  providers: [
    { provide: EXECUTION_REPOSITORY, useClass: ExecutionMongoRepository },
    CreateExecutionUseCase,
    UpdateExecutionUseCase,
    DeleteExecutionUseCase,
    GetExecutionByIdUseCase,
    GetAllExecutionsUseCase,
  ],
  exports: [
    EXECUTION_REPOSITORY,
    CreateExecutionUseCase,
    UpdateExecutionUseCase,
    DeleteExecutionUseCase,
    GetExecutionByIdUseCase,
    GetAllExecutionsUseCase,
  ],
})
export class ExecutionModule {}
