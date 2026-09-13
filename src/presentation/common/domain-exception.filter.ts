import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from '@/base/error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = this.resolveStatus(exception);

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }

  private resolveStatus(exception: DomainError): number {
    if (exception.code.endsWith('_NOT_FOUND')) {
      return HttpStatus.NOT_FOUND;
    }
    if (
      exception.code === 'INVALID_PIPELINE' ||
      exception.code === 'INVALID_STEP_TRANSITION'
    ) {
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
