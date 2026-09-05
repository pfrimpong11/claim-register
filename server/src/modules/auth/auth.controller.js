export class AuthController {
  /**
   * @param {object} input
   * @param {import('./auth.service.js').AuthService} input.authService
   * @param {ReturnType<import('../../config/env.js').parseEnvironment>} input.config
   */
  constructor({ authService, config }) {
    this.authService = authService;
    this.config = config;
  }

  /** @type {import('express').RequestHandler} */
  login = async (request, response, next) => {
    try {
      const result = await this.authService.login({
        ...request.body,
        correlationId: String(request.id),
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });
      const cookieOptions = this.cookieOptions(result.expiresAt);
      response.cookie(this.config.SESSION_COOKIE_NAME, result.sessionToken, {
        ...cookieOptions,
        httpOnly: true,
      });
      response.cookie(this.config.CSRF_COOKIE_NAME, result.csrfToken, {
        ...cookieOptions,
        httpOnly: false,
      });
      return response.json({ data: { user: result.user, csrfToken: result.csrfToken } });
    } catch (error) {
      return next(error);
    }
  };

  /** @type {import('express').RequestHandler} */
  me = (request, response) => response.json({ data: { user: request.auth?.user } });

  /** @type {import('express').RequestHandler} */
  logout = async (request, response, next) => {
    try {
      if (!request.auth) return next(new Error('Authenticated route has no principal.'));
      await this.authService.logout({
        sessionId: request.auth.sessionId,
        user: request.auth.user,
        correlationId: String(request.id),
        ipAddress: request.ip,
        userAgent: request.get('user-agent'),
      });
      /** @type {import('express').CookieOptions} */
      const clearOptions = {
        secure: this.config.NODE_ENV === 'production',
        sameSite: this.config.COOKIE_SAME_SITE,
        path: '/',
      };
      response.clearCookie(this.config.SESSION_COOKIE_NAME, clearOptions);
      response.clearCookie(this.config.CSRF_COOKIE_NAME, clearOptions);
      return response.status(204).end();
    } catch (error) {
      return next(error);
    }
  };

  /**
   * @param {Date} expiresAt
   * @returns {import('express').CookieOptions}
   */
  cookieOptions(expiresAt) {
    return {
      secure: this.config.NODE_ENV === 'production',
      sameSite: this.config.COOKIE_SAME_SITE,
      path: '/',
      expires: expiresAt,
    };
  }
}
