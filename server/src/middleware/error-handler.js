import { AppError } from '../shared/errors.js';
import multer from 'multer';

/** @type {import('express').RequestHandler} */
export function notFound(request, _response, next) {
  return next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested resource was not found.',
      status: 404,
      details: { method: request.method, path: request.path },
    }),
  );
}

/** @type {import('express').ErrorRequestHandler} */
export function errorHandler(error, request, response, _next) {
  if (error instanceof multer.MulterError) {
    error = new AppError({
      code: error.code === 'LIMIT_FILE_SIZE' ? 'DOCUMENT_TOO_LARGE' : 'INVALID_MULTIPART_UPLOAD',
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'The document exceeds the configured size limit.'
          : 'The document upload is invalid.',
      status: 400,
    });
  }
  if (error?.code === 'P2034') {
    error = new AppError({
      code: 'CONCURRENT_WRITE_CONFLICT',
      message:
        'The record changed during this request. Retry the operation with the same idempotency key.',
      status: 409,
    });
  }
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  const code = known ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = known ? error.message : 'An unexpected error occurred.';

  request.log?.[status >= 500 ? 'error' : 'warn'](
    { err: error, code, status, requestId: request.id },
    'request failed',
  );

  return response.status(status).json({
    error: {
      code,
      message,
      ...(known && error.details !== undefined ? { details: error.details } : {}),
      correlationId: request.id,
    },
  });
}
