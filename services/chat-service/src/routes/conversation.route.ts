import { createConversationHandler, listConveraationHandler } from '@/controllers/conversation.controller';
import { attachAuthenticatedUser } from '@/middleware/authenticated-user';
import { createConversationSchema, listConversationsQuerySchema } from '@/validation/conversation.schema';
import { validateRequest } from '@chatapp/common';
import { Router } from 'express';
export const conversationRouter: Router = Router();



conversationRouter.use(attachAuthenticatedUser);

conversationRouter.post(
    '/',
    validateRequest({ body: createConversationSchema }),
    createConversationHandler
)

conversationRouter.get(
    '/',
    validateRequest({ query: listConversationsQuerySchema }),
    listConveraationHandler,
);
