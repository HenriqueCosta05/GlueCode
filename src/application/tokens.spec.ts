import {
  STEP_REPOSITORY,
  PIPELINE_REPOSITORY,
  CONNECTOR_REPOSITORY,
  EXECUTION_REPOSITORY,
  LOG_ENTRY_REPOSITORY,
  LOGGER_PORT,
  STEP_EXECUTOR_REGISTRY,
  PIPELINE_EXECUTION_QUEUE,
} from './tokens';

describe('application tokens', () => {
  it('are all unique values', () => {
    const symbolTokens = [
      STEP_REPOSITORY,
      PIPELINE_REPOSITORY,
      CONNECTOR_REPOSITORY,
      EXECUTION_REPOSITORY,
      LOG_ENTRY_REPOSITORY,
      LOGGER_PORT,
      STEP_EXECUTOR_REGISTRY,
    ];
    expect(new Set(symbolTokens).size).toBe(symbolTokens.length);
    expect(typeof PIPELINE_EXECUTION_QUEUE).toBe('string');
  });
});
