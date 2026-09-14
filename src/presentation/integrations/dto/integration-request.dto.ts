import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PipelineStatus, StepKind } from '@/@types/enums';
import type { StepConfig } from '@/@types/domain';

export class StepRequestDto {
  @IsString()
  id!: string;

  @IsEnum(StepKind)
  kind!: StepKind;

  @IsObject()
  config!: StepConfig;
}

export class CreateIntegrationRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PipelineStatus)
  status?: PipelineStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepRequestDto)
  steps!: StepRequestDto[];
}

export class UpdateIntegrationRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PipelineStatus)
  status?: PipelineStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepRequestDto)
  steps!: StepRequestDto[];
}
