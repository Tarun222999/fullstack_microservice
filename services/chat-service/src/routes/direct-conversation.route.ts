import { createDirectConversationHandler } from '@/controllers/conversation.controller';
import { attachAuthenticatedUser } from '@/middleware/authenticated-user';
import { createDirectConversationSchema } from '@/validation/conversation.schema';
import { validateRequest } from '@chatapp/common';
import { Router } from 'express';

export const directConversationRouter: Router = Router();

directConversationRouter.use(attachAuthenticatedUser);

directConversationRouter.post(
  '/',
  validateRequest({ body: createDirectConversationSchema }),
  createDirectConversationHandler,
);
