import pino from 'pino';
import { context, trace } from '@opentelemetry/api';

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
    mixin() {
      const span = trace.getSpan(context.active());
      const spanContext = span?.spanContext();

      if (!spanContext?.traceId || !spanContext?.spanId) {
        return {};
      }

      return {
        trace_id: spanContext.traceId,
        span_id: spanContext.spanId,
      };
    },
    transport,
    ...rest,
  });
};
