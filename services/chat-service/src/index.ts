import { createApp } from '@/app';
import { createServer } from 'http';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { closeMongoClient, getMongoClient } from '@/clients/mongo.client';
import { closeRedis, connectRedis } from '@/clients/redis.client';
import { startConsumers } from '@/messaging/rabbitmq.consumer';

const main = async () => {
    try {
        await Promise.all([getMongoClient(), connectRedis(), startConsumers()]);

        const app = createApp();
        const server = createServer(app);

        const port = env.CHAT_SERVICE_PORT;

        server.listen(port, () => {
            logger.info({ port }, 'Chat service is running');
        });

        const shutdown = () => {
            logger.info('Shutting down chat service...');
            Promise.all([closeRedis(), closeMongoClient()])
                .catch((error: unknown) => {
                    logger.error({ error }, 'Error during shutdown tasks');
                })
                .finally(() => {
                    server.close(() => process.exit(0));
                });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    } catch (error) {
        logger.error({ error }, 'Failed to start chat service');
        process.exit(1);
    }
};

void main();