import { AppError } from '../shared/errors.js';
import { ZodError } from 'zod';

/**
 * @param {{ body?: import('zod').ZodType, params?: import('zod').ZodType, query?: import('zod').ZodType }} schemas
 * @returns {import('express').RequestHandler}
 */
export function validate(schemas) {
  return function validationMiddleware(request, _response, next) {
    try {
      if (schemas.body) request.body = schemas.body.parse(request.body);
      if (schemas.params) request.params = schemas.params.parse(request.params);
      if (schemas.query) {
        request.validatedQuery = schemas.query.parse(request.query);
      }
      return next();
    } catch (error) {
      const issues = error instanceof ZodError ? error.issues : undefined;
      return next(
        new AppError({
          code: 'VALIDATION_ERROR',
          message: 'The request contains invalid data.',
          status: 400,
          details: issues?.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        }),
      );
    }
  };
}
