import { AppError } from '../shared/errors.js';
import { safeEqual, sha256 } from '../modules/auth/auth.service.js';

/**
 * @param {{ cookieName: string }} input
 * @returns {import('express').RequestHandler}
 */
export function createCsrfProtection({ cookieName }) {
  return function csrfProtection(request, _response, next) {
    const headerToken = request.get('x-csrf-token');
    const cookieToken = request.cookies?.[cookieName];
    const expectedHash = request.auth?.csrfTokenHash;
    if (
      !headerToken ||
      !cookieToken ||
      !expectedHash ||
      !safeEqual(headerToken, cookieToken) ||
      !safeEqual(sha256(headerToken), expectedHash)
    ) {
      return next(
        new AppError({
          code: 'CSRF_TOKEN_INVALID',
          message: 'The CSRF token is missing or invalid.',
          status: 403,
        }),
      );
    }
    return next();
  };
}
