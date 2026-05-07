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
  const tempPubClient = baseClient.duplicate();
  const tempSubClient = baseClient.duplicate();

  try {
    await Promise.all([tempPubClient.connect(), tempSubClient.connect()]);
  } catch (error) {
    await Promise.allSettled([tempPubClient.quit(), tempSubClient.quit()]);
    throw error;
  }

  pubClient = tempPubClient;
  subClient = tempSubClient;

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

  const results = await Promise.allSettled(clients.map(async (client) => client.quit()));

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.warn(
        { err: result.reason, client: index === 0 ? 'pubClient' : 'subClient' },
        'Failed to close socket Redis adapter client cleanly',
      );
    }
  });

  pubClient = null;
  subClient = null;
  logger.info('Socket Redis adapter clients closed');
};
