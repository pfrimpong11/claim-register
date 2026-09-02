import { Redis } from 'ioredis';

/**
 * @param {string} redisUrl
 * @param {{ lazyConnect?: boolean }} [options]
 */
export function createRedisConnection(redisUrl, options = {}) {
  return new Redis(redisUrl, {
    lazyConnect: options.lazyConnect ?? true,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
  });
}

/** @param {import('ioredis').default} redis */
export async function ensureRedisConnected(redis) {
  if (redis.status === 'wait') await redis.connect();
  await redis.ping();
}
