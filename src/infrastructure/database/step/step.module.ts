import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { STEP_REPOSITORY } from '@/application/tokens';
import { CreateStepUseCase } from '@/application/use-cases/step/create-step.use-case';
import { UpdateStepUseCase } from '@/application/use-cases/step/update-step.use-case';
import { DeleteStepUseCase } from '@/application/use-cases/step/delete-step.use-case';
import { GetStepByIdUseCase } from '@/application/use-cases/step/get-step-by-id.use-case';
import { GetAllStepsUseCase } from '@/application/use-cases/step/get-all-steps.use-case';
import { StepSchema, StepSchemaClass } from './step.schema';
import { StepMongoRepository } from './step.mongo.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StepSchemaClass.name, schema: StepSchema },
    ]),
  ],
  providers: [
    { provide: STEP_REPOSITORY, useClass: StepMongoRepository },
    CreateStepUseCase,
    UpdateStepUseCase,
    DeleteStepUseCase,
    GetStepByIdUseCase,
    GetAllStepsUseCase,
  ],
  exports: [
    STEP_REPOSITORY,
    CreateStepUseCase,
    UpdateStepUseCase,
    DeleteStepUseCase,
    GetStepByIdUseCase,
    GetAllStepsUseCase,
  ],
})
export class StepModule {}
