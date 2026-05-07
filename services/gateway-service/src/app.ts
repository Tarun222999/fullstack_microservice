import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from '@/middleware/error-handler';
import { registerRoutes } from '@/routes';
import { env } from '@/config/env';

const allowedOrigins = env.GATEWAY_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const createApp = (): Application => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  registerRoutes(app);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });
  app.use(errorHandler);
  return app;
};
