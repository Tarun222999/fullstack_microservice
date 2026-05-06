import {
  createConversationHandler,
  createMessageHandler,
  getConversationHandler,
  listConversationHandler,
  listMessageHandler,
} from '@/controllers/conversation.controller';
import { attachAuthenticatedUser } from '@/middleware/authenticated-user';
import {
  createConversationSchema,
  listConversationsQuerySchema,
} from '@/validation/conversation.schema';
import { createMessageBodySchema, listMessagesQuerySchema } from '@/validation/message.schema';
import { conversationIdParamsSchema } from '@/validation/shared.schema';
import { validateRequest } from '@chatapp/common';
import { Router } from 'express';

export const conversationRouter: Router = Router();

conversationRouter.use(attachAuthenticatedUser);

conversationRouter.post(
  '/',
  validateRequest({ body: createConversationSchema }),
  createConversationHandler,
);
conversationRouter.get(
  '/',
  validateRequest({ query: listConversationsQuerySchema }),
  listConversationHandler,
);
conversationRouter.get(
  '/:id',
  validateRequest({ params: conversationIdParamsSchema }),
  getConversationHandler,
);

conversationRouter.post(
  '/:id/messages',
  validateRequest({ params: conversationIdParamsSchema, body: createMessageBodySchema }),
  createMessageHandler,
);

conversationRouter.get(
  '/:id/messages',
  validateRequest({ params: conversationIdParamsSchema, query: listMessagesQuerySchema }),
  listMessageHandler,
);
