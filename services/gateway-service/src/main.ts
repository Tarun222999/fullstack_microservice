import { createApp } from './app';
import { createServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { shutdownGatewayTelemetry } from './tracing';

const main = async () => {
  try {
    const app = createApp();

    const server = createServer(app);

    const port = env.PORT ?? env.GATEWAY__PORT;

    server.listen(port, () => {
      logger.info({ port }, 'Gateway service is running');
    });

    let shutdownStarted = false;
    const shutdown = () => {
      if (shutdownStarted) {
        return;
      }
      shutdownStarted = true;
      logger.info('Shutting down gateway service');

      const forceExitTimer = setTimeout(() => {
        logger.error('Forced gateway shutdown after timeout');
        process.exit(1);
      }, 10_000);
      forceExitTimer.unref();

      server.close(() => {
        shutdownGatewayTelemetry()
          .catch((error: unknown) => {
            logger.error({ error }, 'error during shutdown tasks');
          })
          .finally(() => {
            clearTimeout(forceExitTimer);
            process.exit(0);
          });
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start gateway service');
    console.log(error);
    process.exit(1);
  }
};

void main();
