import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Schema } from '@/@types/schema';

export type IntegrationEvent =
  'integration.created' | 'integration.updated' | 'integration.deleted';

@Injectable()
export class IntegrationEventsEmitter {
  private readonly emitter = new EventEmitter();

  emit(event: IntegrationEvent, payload: Schema): void {
    this.emitter.emit(event, payload);
  }

  on(event: IntegrationEvent, listener: (payload: Schema) => void): void {
    this.emitter.on(event, listener);
  }
}
