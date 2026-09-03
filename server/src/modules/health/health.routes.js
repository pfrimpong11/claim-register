import { Router } from 'express';

/** @param {import('./health.service.js').HealthService} healthService */
export function createHealthRouter(healthService) {
  const router = Router();

  router.get('/live', (_request, response) => response.json(healthService.live()));
  router.get('/metrics', (_request, response) =>
    response.json(healthService.metrics?.snapshot() ?? {}),
  );
  router.get('/ready', async (_request, response, next) => {
    try {
      const readiness = await healthService.ready();
      response.status(readiness.ready ? 200 : 503).json({
        status: readiness.ready ? 'ready' : 'not_ready',
        checks: readiness.checks,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
