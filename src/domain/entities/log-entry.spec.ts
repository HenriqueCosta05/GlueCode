import { LogEntry } from './log-entry';

describe('LogEntry', () => {
  it('holds level, message, optional context and executionId', () => {
    const entry = new LogEntry(
      'l1',
      'info',
      'Step executed',
      { stepId: 's1' },
      'e1',
    );

    expect(entry.id).toBe('l1');
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Step executed');
    expect(entry.context).toEqual({ stepId: 's1' });
    expect(entry.executionId).toBe('e1');
  });
});
