import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LogEntryRepository } from '@/application/repositories/log-entry.repository';
import { LogEntry } from '@/domain/entities/log-entry';
import { LogEntryDocument, LogEntrySchemaClass } from './log-entry.schema';
import { LogEntryMapper } from './log-entry.mapper';

@Injectable()
export class LogEntryMongoRepository implements LogEntryRepository {
  private readonly mapper = new LogEntryMapper();

  constructor(
    @InjectModel(LogEntrySchemaClass.name)
    private readonly model: Model<LogEntryDocument>,
  ) {}

  async createLogEntry(logEntry: LogEntry): Promise<boolean> {
    try {
      await this.model.create(this.mapper.mapTo(logEntry));
      return true;
    } catch {
      return false;
    }
  }

  async deleteLogEntry(logEntry: LogEntry): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: logEntry.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(logEntryId: string): Promise<LogEntry | null> {
    const doc = await this.model.findById(logEntryId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllLogEntries(): Promise<LogEntry[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
