import "dotenv/config"

import { createEnv, z } from "@chatapp/common"

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65_535).optional(),
    USER_SERVICE_PORT: z.coerce.number().int().min(0).max(65_535).default(4001),
    USER_DB_URL: z.string(),
    RABBITMQ_URL: z.string().optional(),
    INTERNAL_API_TOKEN: z.string().min(16),
    OUTBOX_ENABLED: z.coerce.boolean().default(false),
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(2_000),
    OUTBOX_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
    OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(100).default(10),
    CONSUMER_DEDUPE_ENABLED: z.coerce.boolean().default(true),
    CONSUMER_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
});

type EnvType = z.infer<typeof envSchema>;


export const env: EnvType = createEnv(envSchema, {
    serviceName: 'user-service'
})

export type Env = typeof env
