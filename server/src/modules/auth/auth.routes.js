import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { loginBodySchema } from './auth.schemas.js';

/**
 * @param {object} input
 * @param {import('./auth.controller.js').AuthController} input.controller
 * @param {import('express').RequestHandler} input.authenticate
 * @param {import('express').RequestHandler} input.csrfProtection
 * @param {import('express').RequestHandler} input.loginRateLimiter
 */
export function createAuthRouter({ controller, authenticate, csrfProtection, loginRateLimiter }) {
  const router = Router();
  router.post('/login', loginRateLimiter, validate({ body: loginBodySchema }), controller.login);
  router.get('/me', authenticate, controller.me);
  router.post('/logout', authenticate, csrfProtection, controller.logout);
  return router;
}
