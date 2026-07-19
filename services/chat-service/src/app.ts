import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from '@/middleware/error-handler';
import { createInternalAuthMiddleware, createRequestLogger } from '@chatapp/common';
import { env } from './config/env';
import { registerRoutes } from './routes';
import { logger } from '@/utils/logger';

export const createApp = (): Application => {
  const app = express();
  const internalAuthMiddleware = createInternalAuthMiddleware(env.INTERNAL_API_TOKEN, {
    exemptPaths: ['/health'],
  });

  app.use(helmet());
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    createRequestLogger({
      logger,
      skipPaths: ['/health'],
      skipPathPrefixes: ['/socket.io'],
    }),
  );
  app.use((req, res, next) => {
    if (req.path.startsWith('/socket.io')) {
      next();
      return;
    }

    internalAuthMiddleware(req, res, next);
  });

  registerRoutes(app);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
};
