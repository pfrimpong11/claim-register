import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

/**
 * @param {object} input
 * @param {import('ioredis').default} input.redis
 * @param {number} input.windowMs
 * @param {number} input.limit
 */
export function createGlobalRateLimiter({ redis, windowMs, limit }) {
  return createRedisRateLimiter({
    redis,
    windowMs,
    limit,
    prefix: 'rl:global:',
    passOnStoreError: true,
  });
}

/**
 * @param {object} input
 * @param {import('ioredis').default} input.redis
 * @param {number} input.windowMs
 * @param {number} input.limit
 */
export function createLoginRateLimiter({ redis, windowMs, limit }) {
  return createRedisRateLimiter({
    redis,
    windowMs,
    limit,
    prefix: 'rl:login:',
    passOnStoreError: false,
  });
}

/**
 * @param {object} input
 * @param {import('ioredis').default} input.redis
 * @param {number} input.windowMs
 * @param {number} input.limit
 * @param {string} input.prefix
 * @param {boolean} input.passOnStoreError
 */
function createRedisRateLimiter({ redis, windowMs, limit, prefix, passOnStoreError }) {
  const store = new RedisStore({
    prefix,
    sendCommand: (command, ...args) =>
      /** @type {Promise<import('rate-limit-redis').RedisReply>} */ (redis.call(command, ...args)),
  });

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store,
    passOnStoreError,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
      },
    },
  });
}
