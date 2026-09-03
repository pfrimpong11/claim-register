import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';

/**
 * @param {object} input
 * @param {import('ioredis').default} input.redis
 * @param {number} input.windowMs
 * @param {number} input.limit
 * @param {string} [input.namespace]
 */
export function createGlobalRateLimiter({ redis, windowMs, limit, namespace }) {
  return createRedisRateLimiter({
    redis,
    windowMs,
    limit,
    prefix: rateLimitPrefix(namespace, 'global'),
    passOnStoreError: true,
  });
}

/**
 * @param {object} input
 * @param {import('ioredis').default} input.redis
 * @param {number} input.windowMs
 * @param {number} input.limit
 * @param {string} [input.namespace]
 */
export function createLoginRateLimiter({ redis, windowMs, limit, namespace }) {
  return createRedisRateLimiter({
    redis,
    windowMs,
    limit,
    prefix: rateLimitPrefix(namespace, 'login'),
    passOnStoreError: false,
  });
}

/** @param {string|undefined} namespace @param {string} scope */
function rateLimitPrefix(namespace, scope) {
  return namespace ? `rl:${namespace}:${scope}:` : `rl:${scope}:`;
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
