import Redis from 'ioredis';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';

let redis: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { lazyConnect: true });

    redis.on('error', (error) => {
      logger.error({ err: error }, 'Redis connection error');
    });

    redis.on('connect', () => {
      logger.info('Redis connection established');
    });

    redis.on('reconnect', () => {
      logger.info('Redis reconnecting...');
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redis;
};

export const connectRedis = async () => {
  const client = getRedisClient();
  if (client.status === 'ready' || client.status === 'connecting') {
    return;
  }
  await client.connect();
};

export const closeRedis = async () => {
  if (!redis) {
    return;
  }

  await redis.quit();
  redis = null;
};
