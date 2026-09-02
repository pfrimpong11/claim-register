import { AppError } from '../../shared/errors.js';

/**
 * @param {string} permission
 * @returns {import('express').RequestHandler}
 */
export function requirePermission(permission) {
  return function permissionGuard(request, _response, next) {
    if (!request.auth?.user.permissions.includes(permission)) {
      return next(
        new AppError({
          code: 'PERMISSION_DENIED',
          message: 'You do not have permission to perform this action.',
          status: 403,
        }),
      );
    }
    return next();
  };
}
