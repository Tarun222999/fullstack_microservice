import type { Router } from 'express';
import { userRoutes } from './user.routes';

export const registerRoutes = (app: Router) => {
  // Health check endpoint for Docker/K8s
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'user-service' });
  });

  app.use('/users', userRoutes);
};
