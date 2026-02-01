import { z, type ZodObject, type ZodRawShape } from "zod";

interface EnvOptions {
    source?: NodeJS.ProcessEnv
    serviceName?: string
}

type SchemaOutput<TSchema extends ZodRawShape> = z.infer<ZodObject<TSchema>>

export const createEnv = <TSchema extends ZodRawShape>(
    schema: ZodObject<TSchema>,
    options: EnvOptions = {}
): SchemaOutput<TSchema> => {
    const { source = process.env, serviceName = "service" } = options;

    const parsed = schema.safeParse(source)

    if (!parsed.success) {
        const formattedErrors = parsed.error.format()
        throw new Error(
            `[${serviceName}] Environment variable validation failed: ${JSON.stringify(formattedErrors)}`
        )


    }
    return parsed.data;
}

export type EnvSchema<TShape extends ZodRawShape> = ZodObject<TShape>