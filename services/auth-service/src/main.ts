import { createApp } from './app';
import { createServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { closeDatabase, connectToDatabase } from '@/db/sequilize';
import { initModels } from '@/models';
import {
  closePublisher,
  initPublisher,
  startOutboxPublisher,
  stopOutboxPublisher,
} from '@/messaging/event-publishing';
import { shutdownAuthTelemetry } from './tracing';

const main = async () => {
  try {
    await connectToDatabase();
    await initModels();
    await initPublisher();
    await startOutboxPublisher();
    const app = createApp();

    const server = createServer(app);

    const port = env.PORT ?? env.AUTH_SERVICE_PORT;

    server.listen(port, () => {
      logger.info({ port }, 'Auth service is running');
    });

    const shutdown = async () => {
      logger.info('Shutting down auth service');

      let hasErrors = false;
      try {
        await stopOutboxPublisher();
      } catch (error) {
        hasErrors = true;
        logger.error({ error }, 'error stopping outbox publisher');
      }

      await Promise.all([closeDatabase(), closePublisher(), shutdownAuthTelemetry()])
        .catch((error: unknown) => {
          hasErrors = true;
          logger.error({ error }, 'error during shutdown tasks');
        })
        .finally(() => {
          server.close(() => process.exit(hasErrors ? 1 : 0));
        });
    };

    process.on('SIGINT', () => {
      void shutdown();
    });
    process.on('SIGTERM', () => {
      void shutdown();
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start auth service');
    process.exit(1);
  }
};

void main();
