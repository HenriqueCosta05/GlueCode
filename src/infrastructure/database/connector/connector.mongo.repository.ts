import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConnectorRepository } from '@/application/repositories/connector.repository';
import { Connector } from '@/domain/entities/connector';
import { ConnectorDocument, ConnectorSchemaClass } from './connector.schema';
import { ConnectorMapper } from './connector.mapper';

@Injectable()
export class ConnectorMongoRepository implements ConnectorRepository {
  private readonly mapper = new ConnectorMapper();

  constructor(
    @InjectModel(ConnectorSchemaClass.name)
    private readonly model: Model<ConnectorDocument>,
  ) {}

  async createConnector(connector: Connector): Promise<boolean> {
    await this.model.create(this.mapper.mapTo(connector));
    return true;
  }

  async updateConnector(connector: Connector): Promise<Connector | null> {
    const doc = await this.model
      .findByIdAndUpdate(connector.id, this.mapper.mapTo(connector), {
        new: true,
      })
      .exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async deleteConnector(connector: Connector): Promise<boolean> {
    const result = await this.model.deleteOne({ _id: connector.id }).exec();
    return result.deletedCount === 1;
  }

  async existsById(connectorId: string): Promise<Connector | null> {
    const doc = await this.model.findById(connectorId).exec();
    return doc ? this.mapper.mapFrom(doc) : null;
  }

  async getAllConnectors(): Promise<Connector[]> {
    const docs = await this.model.find().exec();
    return docs.map((doc) => this.mapper.mapFrom(doc));
  }
}
