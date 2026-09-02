import { Queue, QueueEvents } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../config/env.js';
import { createRedisConnection, ensureRedisConnected } from '../infrastructure/redis.js';
import { logger } from '../shared/logger.js';
import { JOB_NAMES, QUEUE_NAME } from './jobs.js';
import { WorkerRuntime } from './runtime.js';

if (process.env.RUN_INFRA_INTEGRATION === 'true') {
  describe('BullMQ worker runtime integration', () => {
    let connection;
    let queueConnection;
    let eventsConnection;
    let queue;
    let queueEvents;

    beforeAll(async () => {
      connection = createRedisConnection(env.REDIS_URL);
      queueConnection = createRedisConnection(env.REDIS_URL);
      eventsConnection = createRedisConnection(env.REDIS_URL);
      queue = new Queue(QUEUE_NAME, { connection: queueConnection });
      queueEvents = new QueueEvents(QUEUE_NAME, { connection: eventsConnection });
      await Promise.all([
        ensureRedisConnected(connection),
        ensureRedisConnected(queueConnection),
        ensureRedisConnected(eventsConnection),
        queueEvents.waitUntilReady(),
      ]);
      await queue.drain(true);
    });

    afterAll(async () => {
      await queue.drain(true);
      await queue.close();
      await queueEvents.close();
      for (const redis of [connection, queueConnection, eventsConnection]) {
        if (redis.status !== 'end') await redis.quit();
      }
    });

    it('runs the shared processor through sequential embedded/detached runtimes', async () => {
      for (const mode of ['embedded', 'standalone']) {
        const runtime = new WorkerRuntime({ connection, logger, concurrency: 1 });
        await runtime.start();
        expect(runtime.isReady()).toBe(true);
        const job = await queue.add(
          JOB_NAMES.FOUNDATION_PING,
          { mode },
          { removeOnComplete: true },
        );
        const result = await job.waitUntilFinished(queueEvents, 5_000);
        expect(result).toMatchObject({ ok: true });
        await runtime.close();
        expect(runtime.isReady()).toBe(false);
      }
    });
  });
} else {
  describe.skip('BullMQ worker runtime integration', () => {
    it('requires RUN_INFRA_INTEGRATION=true and Redis', () => {});
  });
}
