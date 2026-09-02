import { createServer } from 'node:http';
import { createServerRuntime } from './runtime.js';
import { logger } from './shared/logger.js';

let shuttingDown = false;

try {
  const runtime = await createServerRuntime();
  const httpServer = createServer(runtime.app);
  httpServer.requestTimeout = 15_000;
  httpServer.headersTimeout = 10_000;
  httpServer.keepAliveTimeout = 5_000;

  httpServer.listen(runtime.config.PORT, runtime.config.HOST, () => {
    logger.info(
      {
        host: runtime.config.HOST,
        port: runtime.config.PORT,
        embeddedWorker: runtime.config.START_EMBEDDED_WORKER,
        storageProvider: runtime.config.STORAGE_PROVIDER,
      },
      'server ready',
    );
  });

  /** @param {string} signal */
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'graceful shutdown started');

    const forceExit = setTimeout(() => {
      logger.fatal('graceful shutdown timed out');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    httpServer.close(async (error) => {
      try {
        await runtime.close();
        if (error) throw error;
        clearTimeout(forceExit);
        logger.info('graceful shutdown complete');
        process.exit(0);
      } catch (shutdownError) {
        logger.fatal({ err: shutdownError }, 'graceful shutdown failed');
        process.exit(1);
      }
    });
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
} catch (error) {
  logger.fatal({ err: error }, 'server startup failed');
  process.exit(1);
}
