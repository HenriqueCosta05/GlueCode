import { ArgumentsHost } from '@nestjs/common';
import {
  StepNotFoundError,
  InvalidPipelineError,
} from '@/shared/errors/domain';
import { DomainExceptionFilter } from './domain-exception.filter';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

function buildWsHost() {
  const emit = jest.fn();
  const client = { emit };
  const host = {
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ArgumentsHost;
  return { host, emit };
}

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('maps a *_NOT_FOUND error to 404', () => {
    const { host, status, json } = buildHost();

    filter.catch(new StepNotFoundError('Step s1 was not found.'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'STEP_NOT_FOUND',
      message: 'Step s1 was not found.',
    });
  });

  it('maps INVALID_PIPELINE to 400', () => {
    const { host, status } = buildHost();

    filter.catch(new InvalidPipelineError('needs a step'), host);

    expect(status).toHaveBeenCalledWith(400);
  });

  it('does not call HTTP-only methods for a non-HTTP (WS) context, and emits an exception event instead', () => {
    const { host, emit } = buildWsHost();

    expect(() =>
      filter.catch(new InvalidPipelineError('needs a step'), host),
    ).not.toThrow();

    expect(emit).toHaveBeenCalledWith('exception', {
      code: 'INVALID_PIPELINE',
      message: 'needs a step',
    });
  });
});
