import { context, trace } from '@opentelemetry/api';

import type { Logger } from 'pino';
import type { RequestHandler } from 'express';

type RequestLoggerOptions = {
  logger: Logger;
  skipPaths?: string[];
  skipPathPrefixes?: string[];
};

export const createRequestLogger = ({
  logger,
  skipPaths = [],
  skipPathPrefixes = [],
}: RequestLoggerOptions): RequestHandler => {
  return (req, res, next) => {
    if (
      skipPaths.includes(req.path) ||
      skipPathPrefixes.some((prefix) => req.path.startsWith(prefix))
    ) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    const spanContext = trace.getSpan(context.active())?.spanContext();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      logger.info(
        {
          ...(spanContext?.traceId ? { trace_id: spanContext.traceId } : {}),
          ...(spanContext?.spanId ? { span_id: spanContext.spanId } : {}),
          http_method: req.method,
          http_target: req.originalUrl,
          http_route: req.route?.path,
          http_status_code: res.statusCode,
          duration_ms: Number(durationMs.toFixed(2)),
        },
        'http.request.completed',
      );
    });

    next();
  };
};
