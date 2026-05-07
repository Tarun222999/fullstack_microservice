import pino from 'pino';

import type { Logger, LoggerOptions } from 'pino';

type CreateLoggerOptions = LoggerOptions & {
  name: string;
};

export const createLogger = (options: CreateLoggerOptions): Logger => {
  const { name, ...rest } = options;

  const nodeEnv = (process.env.NODE_ENV ?? '').toLowerCase();
  const usePrettyLogs = nodeEnv !== 'production';
  const transport = usePrettyLogs
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          singleLine: false,
          errorLikeObjectKeys: ['err', 'error'],
          messageKey: 'msg',
          errorProps: '*',
          hideObject: false,
        },
      }
    : undefined;

  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    transport,
    ...rest,
  });
};
