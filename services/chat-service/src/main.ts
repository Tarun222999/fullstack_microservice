import { createApp } from '@/app';
import { createServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { closeMongoClient, getMongoClient } from '@/clients/mongo.client';
import { closeRedis, connectRedis } from '@/clients/redis.client';
import { startConsumers, stopConsumers } from '@/messaging/rabbitmq.consumer';
import { closeSocketServer, startSocketServer } from '@/websocket/socket.server';
import { shutdownChatTelemetry } from './tracing';

const main = async () => {
  try {
    await Promise.all([getMongoClient(), connectRedis(), startConsumers()]);

    const app = createApp();
    const server = createServer(app);
    await startSocketServer(server);

    const port = env.PORT ?? env.CHAT_SERVICE_PORT;

    server.listen(port, () => {
      logger.info({ port }, 'Chat service is running');
    });

    const shutdown = async () => {
      logger.info('Shutting down chat service...');
      await closeSocketServer();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      const results = await Promise.allSettled([
        stopConsumers(),
        closeRedis(),
        closeMongoClient(),
        shutdownChatTelemetry(),
      ]);
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error({ error: result.reason }, 'Error during shutdown task');
        }
      }
      process.exit(results.some((result) => result.status === 'rejected') ? 1 : 0);
    };

    process.on('SIGINT', () => {
      void shutdown();
    });
    process.on('SIGTERM', () => {
      void shutdown();
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start chat service');
    process.exit(1);
  }
};

void main();
