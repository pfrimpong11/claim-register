import { AppError } from '../shared/errors.js';

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
