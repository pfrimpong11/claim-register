import { PrismaClient } from '@prisma/client';

/** @param {import('pino').Logger} logger */
export function createPrismaClient(logger) {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });
  prisma.$on('warn', (event) => logger.warn({ prisma: event }, 'prisma warning'));
  prisma.$on('error', (event) => logger.error({ prisma: event }, 'prisma error'));
  return prisma;
}
