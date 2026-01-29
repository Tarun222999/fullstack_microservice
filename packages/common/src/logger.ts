import pino from 'pino'

import type { Logger, LoggerOptions } from "pino"

type CreateLoggerOptions = LoggerOptions & {
    name: string
}


export const createLogger = (options: LoggerOptions): Logger => {
    const { name, ...rest } = options;


    const transport = process.env.NODE_ENV === "devolopment"
        ? {
            target: "pino_pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard"
            }
        } : undefined;


    return pino({
        name,
        level: process.env.LOG_LEVEL || "info",
        transport,
        ...rest
    })
}
