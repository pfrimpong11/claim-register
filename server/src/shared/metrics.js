export class MetricsRegistry {
  constructor() {
    this.startedAt = new Date();
    this.requests = 0;
    this.errors = 0;
    this.rateLimited = 0;
    this.durationMs = 0;
    this.byStatus = new Map();
  }
  /** @param {number} status @param {number} durationMs */ recordRequest(status, durationMs) {
    this.requests += 1;
    this.durationMs += durationMs;
    if (status >= 400) this.errors += 1;
    if (status === 429) this.rateLimited += 1;
    this.byStatus.set(String(status), (this.byStatus.get(String(status)) ?? 0) + 1);
  }
  snapshot() {
    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      http: {
        requests: this.requests,
        errors: this.errors,
        rateLimited: this.rateLimited,
        averageDurationMs: this.requests ? Math.round(this.durationMs / this.requests) : 0,
        byStatus: Object.fromEntries(this.byStatus),
      },
      process: {
        rssBytes: process.memoryUsage().rss,
        heapUsedBytes: process.memoryUsage().heapUsed,
      },
    };
  }
}
/** @param {MetricsRegistry} metrics @returns {import('express').RequestHandler} */ export function createMetricsMiddleware(
  metrics,
) {
  return (request, response, next) => {
    const started = performance.now();
    response.once('finish', () =>
      metrics.recordRequest(response.statusCode, performance.now() - started),
    );
    next();
  };
}
