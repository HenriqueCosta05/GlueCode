import { StepKind, PipelineStatus } from '@/@types/enums';
import { Pipeline } from '@/domain/entities/pipeline';
import { Step } from '@/domain/entities/step';
import { SchemaAdapter } from './schema';

describe('SchemaAdapter', () => {
  const adapter = new SchemaAdapter();

  it('toSchema converts a Pipeline entity to a JSON-safe Schema', () => {
    const pipeline = new Pipeline(
      'p1',
      [new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' })],
      PipelineStatus.IDLE,
      'My Pipeline',
      'A description',
    );

    const schema = adapter.toSchema(pipeline);

    expect(schema).toEqual({
      pipeline: {
        id: 'p1',
        name: 'My Pipeline',
        description: 'A description',
        status: PipelineStatus.IDLE,
        steps: [
          {
            id: 's1',
            kind: StepKind.LOG,
            config: { kind: StepKind.LOG, level: 'info' },
          },
        ],
      },
    });
  });

  it('toPipelineInput converts a Schema back to Pipeline constructor input', () => {
    const input = adapter.toPipelineInput({
      pipeline: {
        id: 'p1',
        name: 'My Pipeline',
        status: PipelineStatus.IDLE,
        steps: [
          {
            id: 's1',
            kind: StepKind.LOG,
            config: { kind: StepKind.LOG, level: 'info' },
          },
        ],
      },
    });

    expect(input.name).toBe('My Pipeline');
    expect(input.steps).toHaveLength(1);
    expect(input.steps[0]).toBeInstanceOf(Step);
    expect(input.steps[0].id).toBe('s1');
  });
});
