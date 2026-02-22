import { requireAuth } from '@/middleware/require-auth';
import {
    conversationIdParamsSchema,
    createConversationBodySchema,
    listConversationsQuerySchema,
} from '@/validation/conversation.schema';
import { Router } from 'express';
import { validateRequest } from '@chatapp/common';
import {
    createConversationHandler,
    createMessageHandler,
    getConversationHandler,
    listConversationsHandler,
    listMessagesHandler,
} from '@/controller/conversation.controller';
import { createMessageBodySchema, listMessagesQuerySchema } from '@/validation/message.schema';

export const conversationRouter: Router = Router();

conversationRouter.use(requireAuth);

conversationRouter.post(
    '/',
    validateRequest({ body: createConversationBodySchema }),
    createConversationHandler,
);

conversationRouter.get(
    '/',
    validateRequest({ query: listConversationsQuerySchema }),
    listConversationsHandler,
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
    listMessagesHandler,
);