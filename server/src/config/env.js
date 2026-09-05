import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnvironment = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().trim().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://postgres:postgres@127.0.0.1:5432/claims_register'),
    REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default('claims_session'),
    CSRF_COOKIE_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .default('claims_csrf'),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
    // Use "none" when the browser client is served from a different site than the API
    // (for example a Vercel client calling an API on its own domain). Browsers only accept
    // SameSite=None cookies with the Secure flag, which the API sets in production.
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    CLIENT_ORIGINS: z.string().default('http://localhost:3000'),
    TRUST_PROXY: z.string().default('false'),
    BODY_LIMIT: z
      .string()
      .regex(/^\d+(kb|mb)$/i)
      .default('100kb'),
    GLOBAL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60_000),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    START_EMBEDDED_WORKER: booleanFromEnvironment,
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),
    CLOUDINARY_CLOUD_NAME: optionalSecret,
    CLOUDINARY_API_KEY: optionalSecret,
    CLOUDINARY_API_SECRET: optionalSecret,
    LOCAL_UPLOAD_DIR: z.string().trim().min(1).default('uploads'),
    DOCUMENT_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1024)
      .max(25 * 1024 * 1024)
      .default(10 * 1024 * 1024),
  })
  .superRefine((value, context) => {
    if (value.COOKIE_SAME_SITE === 'none' && value.NODE_ENV !== 'production') {
      context.addIssue({
        code: 'custom',
        message: 'COOKIE_SAME_SITE=none requires NODE_ENV=production (Secure cookies).',
        path: ['COOKIE_SAME_SITE'],
      });
    }
    const cloudinary = [
      value.CLOUDINARY_CLOUD_NAME,
      value.CLOUDINARY_API_KEY,
      value.CLOUDINARY_API_SECRET,
    ];
    const configuredCount = cloudinary.filter(Boolean).length;
    if (configuredCount > 0 && configuredCount < cloudinary.length) {
      context.addIssue({
        code: 'custom',
        message: 'Cloudinary configuration must be entirely present or entirely absent.',
        path: ['CLOUDINARY_CLOUD_NAME'],
      });
    }
  });

/**
 * @param {NodeJS.ProcessEnv} source
 */
export function parseEnvironment(source = process.env) {
  const parsed = environmentSchema.parse(source);
  const cloudinaryConfigured = Boolean(parsed.CLOUDINARY_CLOUD_NAME);

  return Object.freeze({
    ...parsed,
    LOG_LEVEL:
      parsed.LOG_LEVEL ??
      (parsed.NODE_ENV === 'test' ? 'silent' : parsed.NODE_ENV === 'production' ? 'info' : 'debug'),
    CLIENT_ORIGINS: parsed.CLIENT_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    TRUST_PROXY: parseTrustProxy(parsed.TRUST_PROXY),
    STORAGE_PROVIDER: cloudinaryConfigured ? 'cloudinary' : 'local',
  });
}

/** @param {string} value */
function parseTrustProxy(value) {
  if (value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const env = parseEnvironment();
