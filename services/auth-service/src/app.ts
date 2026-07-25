import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from '@/middleware/error-handler';
import { registerRoutes } from '@/routes';
import { env } from './config/env';
import { createInternalAuthMiddleware, createRequestLogger } from '@chatapp/common';
import { logger } from '@/utils/logger';

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: '*',
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(createRequestLogger({ logger, skipPaths: ['/health'] }));
  app.use(
    createInternalAuthMiddleware(env.INTERNAL_API_TOKEN, {
      exemptPaths: ['/health'],
    }),
  );

  registerRoutes(app);
  app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });
  app.use(errorHandler);
  return app;
};
