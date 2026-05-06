import 'dotenv/config';

import { createEnv, z } from '@chatapp/common';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65_535).optional(),
  CHAT_SERVICE_PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
  INTERNAL_API_TOKEN: z.string().min(16),
  JWT_SECRET: z.string().min(32),
  RABBITMQ_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MONGO_URL: z.string().url(),
  CHAT_SOCKET_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173,http://localhost:4173'),
  CONSUMER_DEDUPE_ENABLED: z.coerce.boolean().default(true),
  CONSUMER_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
});

type EnvType = z.infer<typeof envSchema>;

export const env: EnvType = createEnv(envSchema, {
  serviceName: 'chat-service',
});

export type Env = typeof env;
