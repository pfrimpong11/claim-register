import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'claims-register-server' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.sessionToken',
      '*.CLOUDINARY_API_SECRET',
      '*.CLOUDINARY_API_KEY',
    ],
    censor: '[REDACTED]',
  },
});
