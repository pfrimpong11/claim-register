import { AppError } from '../shared/errors.js';

/**
 * @param {object} input
 * @param {import('../modules/auth/auth.service.js').AuthService} input.authService
 * @param {string} input.cookieName
 * @returns {import('express').RequestHandler}
 */
export function createAuthenticate({ authService, cookieName }) {
  return async function authenticate(request, _response, next) {
    try {
      const authentication = await authService.authenticate(request.cookies?.[cookieName]);
      if (!authentication) {
        return next(
          new AppError({
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication is required.',
            status: 401,
          }),
        );
      }
      request.auth = authentication;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
