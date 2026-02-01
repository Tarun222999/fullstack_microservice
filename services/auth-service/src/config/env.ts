import "dotenv/config"

import { createEnv, z } from "@chatapp/common"

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    AUTH_SERVICE_PORT: z.coerce.number().int().min(0).max(65_535).default(4003),
    AUTH_DB_URL: z.string()
})

type EnvType = z.infer<typeof envSchema>;


export const env: EnvType = createEnv(envSchema, {
    serviceName: 'auth-service'
})

export type Env = typeof env