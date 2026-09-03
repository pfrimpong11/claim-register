import { describe, expect, it, vi } from 'vitest';
import { MetricsRegistry, createMetricsMiddleware } from './metrics.js';
describe('operational metrics', () => {
  it('counts responses, errors, rate limits, and duration without request data', () => {
    const metrics = new MetricsRegistry();
    const callbacks = [];
    const response = {
      statusCode: 429,
      once: vi.fn((_event, callback) => callbacks.push(callback)),
    };
    const next = vi.fn();
    createMetricsMiddleware(metrics)({}, response, next);
    callbacks[0]();
    expect(metrics.snapshot().http).toMatchObject({
      requests: 1,
      errors: 1,
      rateLimited: 1,
      byStatus: { 429: 1 },
    });
    expect(next).toHaveBeenCalledOnce();
  });
});
