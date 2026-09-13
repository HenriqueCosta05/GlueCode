import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateLogEntryUseCase } from '@/application/use-cases/log-entry/create-log-entry.use-case';
import { DeleteLogEntryUseCase } from '@/application/use-cases/log-entry/delete-log-entry.use-case';
import { GetLogEntryByIdUseCase } from '@/application/use-cases/log-entry/get-log-entry-by-id.use-case';
import { GetAllLogEntriesUseCase } from '@/application/use-cases/log-entry/get-all-log-entries.use-case';
import { LogEntry } from '@/domain/entities/log-entry';
import { CreateLogEntryRequestDto } from './dto/create-log-entry-request.dto';

@Controller('logs')
export class LogsController {
  constructor(
    private readonly createLogEntryUseCase: CreateLogEntryUseCase,
    private readonly deleteLogEntryUseCase: DeleteLogEntryUseCase,
    private readonly getLogEntryByIdUseCase: GetLogEntryByIdUseCase,
    private readonly getAllLogEntriesUseCase: GetAllLogEntriesUseCase,
  ) {}

  @Post()
  async create(
    @Body() body: CreateLogEntryRequestDto,
  ): Promise<{ created: boolean }> {
    const created = await this.createLogEntryUseCase.execute(body);
    return { created };
  }

  @Get()
  async findAll(): Promise<LogEntry[]> {
    return this.getAllLogEntriesUseCase.execute();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<LogEntry> {
    const logEntry = await this.getLogEntryByIdUseCase.execute({ id });
    if (!logEntry) {
      throw new NotFoundException(`Log entry ${id} not found`);
    }
    return logEntry;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.deleteLogEntryUseCase.execute({ id });
  }
}
