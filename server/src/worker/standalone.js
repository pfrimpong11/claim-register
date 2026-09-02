import { env } from '../config/env.js';
import { createRedisConnection, ensureRedisConnected } from '../infrastructure/redis.js';
import { logger } from '../shared/logger.js';
import { WorkerRuntime } from './runtime.js';

const redis = createRedisConnection(env.REDIS_URL);
const workerRuntime = new WorkerRuntime({
  connection: redis,
  logger,
  concurrency: env.WORKER_CONCURRENCY,
});
let shuttingDown = false;

try {
  await ensureRedisConnected(redis);
  await workerRuntime.start();
  logger.info('standalone worker ready');

  /** @param {string} signal */
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'standalone worker shutdown started');
    try {
      await workerRuntime.close();
      if (redis.status !== 'end') await redis.quit();
      logger.info('standalone worker shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.fatal({ err: error }, 'standalone worker shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
} catch (error) {
  logger.fatal({ err: error }, 'standalone worker startup failed');
  if (redis.status !== 'end') redis.disconnect();
  process.exit(1);
}
