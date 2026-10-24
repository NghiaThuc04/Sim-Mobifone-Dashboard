import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'object' && 'retryAfter' in body) response.setHeader('Retry-After', String(body.retryAfter));
      return response.status(error.getStatus()).setHeader('Cache-Control', 'no-store').json(body);
    }
    const status = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
    if (status === 'entity.too.large' || status === 'entity.parse.failed') {
      return response.status(status === 'entity.too.large' ? 413 : 400).json({ message: 'Invalid request body.' });
    }
    Logger.error('API request failed; database/internal details redacted.', 'HttpErrorFilter');
    return response.status(503).setHeader('Cache-Control', 'no-store').json({ statusCode: 503, message: 'Service temporarily unavailable.' });
  }
}
