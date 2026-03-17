import type Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as SocketIOServer } from 'socket.io';

import { getRedisClient } from '@/clients/redis.client';
import { logger } from '@/utils/logger';

let pubClient: Redis | null = null;
let subClient: Redis | null = null;

const ensureAdapterClients = async (): Promise<{ pubClient: Redis; subClient: Redis }> => {
    if (pubClient && subClient) {
        return { pubClient, subClient };
    }

    const baseClient = getRedisClient();
    pubClient = baseClient.duplicate();
    subClient = baseClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    logger.info('Socket Redis adapter clients connected');
    return { pubClient, subClient };
};

export const attachSocketRedisAdapter = async (ioServer: SocketIOServer): Promise<void> => {
    const clients = await ensureAdapterClients();
    ioServer.adapter(createAdapter(clients.pubClient, clients.subClient));
    logger.info('Socket Redis adapter attached');
};

export const closeSocketRedisAdapter = async (): Promise<void> => {
    const clients = [pubClient, subClient].filter((client): client is Redis => client !== null);
    if (clients.length === 0) {
        return;
    }

    await Promise.all(clients.map(async (client) => client.quit()));
    pubClient = null;
    subClient = null;
    logger.info('Socket Redis adapter clients closed');
};
