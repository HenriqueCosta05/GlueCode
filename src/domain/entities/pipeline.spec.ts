import { StepKind, PipelineStatus } from '@/@types/enums';
import { Step } from './step';
import { Pipeline } from './pipeline';

describe('Pipeline', () => {
  const steps = [
    new Step('s1', StepKind.LOG, { kind: StepKind.LOG, level: 'info' }),
  ];

  it('carries optional name/description metadata', () => {
    const pipeline = new Pipeline(
      'p1',
      steps,
      PipelineStatus.IDLE,
      'My Pipeline',
      'A description',
    );

    expect(pipeline.name).toBe('My Pipeline');
    expect(pipeline.description).toBe('A description');
  });

  it('exposes a copy of its steps via getSteps()', () => {
    const pipeline = new Pipeline('p1', steps, PipelineStatus.IDLE);

    const returned = pipeline.getSteps();

    expect(returned).toEqual(steps);
    expect(returned).not.toBe(steps);
  });
});
