import "dotenv/config"

import { createEnv, z } from "@chatapp/common"

const hasDeprecatedGatewayPort = Boolean(process.env.GATEWAY__PORT)

if (hasDeprecatedGatewayPort) {
    console.warn("[gateway-service] GATEWAY__PORT is deprecated. Please use GATEWAY_PORT instead.")
}

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65_535).optional(),
    GATEWAY__PORT: z.coerce.number().int().min(0).max(65_535).default(4000),
    AUTH_SERVICE_URL: z.string().url(),
    INTERNAL_API_TOKEN: z.string().min(16),
    USER_SERVICE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    CHAT_SERVICE_URL: z.string().url(),
})

type EnvType = z.infer<typeof envSchema>;


export const env: EnvType = createEnv(envSchema, {
    source: {
        ...process.env,
        GATEWAY_PORT: process.env.GATEWAY_PORT ?? process.env.GATEWAY__PORT,
    },
    serviceName: 'gateway-service'
})

export type Env = typeof env
