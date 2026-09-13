import { Schema } from '@/@types/schema';
import { PipelineStatus, StepKind } from '@/@types/enums';
import { IntegrationEventsEmitter } from './integration-events.emitter';

const schema: Schema = {
  pipeline: {
    id: 'p1',
    status: PipelineStatus.IDLE,
    steps: [
      {
        id: 's1',
        kind: StepKind.LOG,
        config: { kind: StepKind.LOG, level: 'info' },
      },
    ],
  },
};

describe('IntegrationEventsEmitter', () => {
  it('delivers emitted payloads to registered listeners for that event', () => {
    const emitter = new IntegrationEventsEmitter();
    const listener = jest.fn();

    emitter.on('integration.created', listener);
    emitter.emit('integration.created', schema);

    expect(listener).toHaveBeenCalledWith(schema);
  });

  it('does not deliver to listeners registered for a different event', () => {
    const emitter = new IntegrationEventsEmitter();
    const listener = jest.fn();

    emitter.on('integration.updated', listener);
    emitter.emit('integration.created', schema);

    expect(listener).not.toHaveBeenCalled();
  });
});
