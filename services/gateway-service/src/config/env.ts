import "dotenv/config"

import { createEnv, z } from "@chatapp/common"

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    GATEWAY__PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
    AUTH_SERVICE_URL: z.string().url(),
    INTERNAL_API_TOKEN: z.string().min(16),
})

type EnvType = z.infer<typeof envSchema>;


export const env: EnvType = createEnv(envSchema, {
    serviceName: 'gateway-service'
})

export type Env = typeof env