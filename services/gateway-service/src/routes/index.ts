import { Router } from 'express';
import { authRouter } from '@/routes/auth.route';
import { userRouter } from '@/routes/user.route';
import { conversationRouter } from '@/routes/conversation.route';
import { directConversationRouter } from '@/routes/direct-conversation.route';

export const registerRoutes = (app: Router) => {
  // Health check endpoint for Docker/K8s
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'gateway-service' });
  });

  app.use('/auth', authRouter);
  app.use('/users', userRouter);
  app.use('/conversations', conversationRouter);
  app.use('/direct-conversations', directConversationRouter);
};
