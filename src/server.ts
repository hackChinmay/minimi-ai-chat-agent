import { app } from './app';
import { env, validateEnv } from './config/env';
import { logger } from './utils/logger';
import { Server } from 'node:http';

function startServer(): Server {
  // Validate environment configuration at startup
  try {
    validateEnv();
  } catch (err) {
    logger.error('Startup failed: Invalid environment configuration', err);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(
      `minimi-ai-chat-agent server started successfully on port ${env.PORT} [${env.NODE_ENV}] (Node ${process.version}, PID ${process.pid})`
    );
    logger.info(`Health check available at http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    server.close((err) => {
      if (err) {
        logger.error('Error during server shutdown', err);
        process.exit(1);
      }
      logger.info('HTTP server closed cleanly. Exiting.');
      process.exit(0);
    });

    // Force exit after 10 seconds if hanging connections persist
    setTimeout(() => {
      logger.error('Forced shutdown: Connections did not close within timeout window.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (err: Error) => {
    logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection', { reason });
    process.exit(1);
  });

  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { startServer };
