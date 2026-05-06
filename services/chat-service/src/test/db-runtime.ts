import { GenericContainer, StartedTestContainer } from 'testcontainers';

type ChatDbRuntime = {
  available: boolean;
  error?: unknown;
  conversationRepository?: any;
  messageRepository?: any;
  conversationService?: any;
  messageService?: any;
  getMongoClient?: any;
  closeMongoClient?: any;
  getRedisClient?: any;
  connectRedis?: any;
  closeRedis?: any;
  cleanup?: () => Promise<void>;
  reset?: () => Promise<void>;
};

let runtimePromise: Promise<ChatDbRuntime> | null = null;
let skipReasonPrinted = false;

export const getChatDbRuntime = async (): Promise<ChatDbRuntime> => {
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = (async () => {
    let mongoContainer: StartedTestContainer | null = null;
    let redisContainer: StartedTestContainer | null = null;

    try {
      mongoContainer = await new GenericContainer('mongo:7').withExposedPorts(27017).start();
      redisContainer = await new GenericContainer('redis:7').withExposedPorts(6379).start();

      const mongoHost = mongoContainer.getHost();
      const mongoPort = mongoContainer.getMappedPort(27017);
      const redisHost = redisContainer.getHost();
      const redisPort = redisContainer.getMappedPort(6379);

      process.env.MONGO_URL = `mongodb://${mongoHost}:${mongoPort}/chat_service_test`;
      process.env.REDIS_URL = `redis://${redisHost}:${redisPort}`;

      const mongoModule = await import('@/clients/mongo.client');
      const redisModule = await import('@/clients/redis.client');
      const conversationRepositoryModule = await import('@/repositories/conversation.repository');
      const messageRepositoryModule = await import('@/repositories/message.repository');
      const conversationServiceModule = await import('@/services/conversation.service');
      const messageServiceModule = await import('@/services/message.service');

      await Promise.all([mongoModule.getMongoClient(), redisModule.connectRedis()]);

      const reset = async () => {
        await conversationRepositoryModule.conversationRepository.removeAll();
        const redis = redisModule.getRedisClient();
        await redis.flushdb();
      };

      const cleanup = async () => {
        await Promise.all([redisModule.closeRedis(), mongoModule.closeMongoClient()]);
        if (mongoContainer) {
          await mongoContainer.stop();
        }
        if (redisContainer) {
          await redisContainer.stop();
        }
      };

      return {
        available: true,
        conversationRepository: conversationRepositoryModule.conversationRepository,
        messageRepository: messageRepositoryModule.messageRepository,
        conversationService: conversationServiceModule.conversationService,
        messageService: messageServiceModule.messageService,
        getMongoClient: mongoModule.getMongoClient,
        closeMongoClient: mongoModule.closeMongoClient,
        getRedisClient: redisModule.getRedisClient,
        connectRedis: redisModule.connectRedis,
        closeRedis: redisModule.closeRedis,
        cleanup,
        reset,
      };
    } catch (error) {
      if (!skipReasonPrinted) {
        const message = error instanceof Error ? error.message : 'Unknown container runtime error';
        console.warn(`[chat-service][db-test] Skipped: ${message}`);
        skipReasonPrinted = true;
      }

      if (mongoContainer) {
        await mongoContainer.stop().catch(() => undefined);
      }
      if (redisContainer) {
        await redisContainer.stop().catch(() => undefined);
      }

      return {
        available: false,
        error,
      };
    }
  })();

  return runtimePromise;
};
