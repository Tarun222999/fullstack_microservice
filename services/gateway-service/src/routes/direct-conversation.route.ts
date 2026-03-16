import { createDirectConversationHandler } from '@/controller/conversation.controller';
import { requireAuth } from '@/middleware/require-auth';
import { createDirectConversationBodySchema } from '@/validation/conversation.schema';
import { Router } from 'express';
import { validateRequest } from '@chatapp/common';

export const directConversationRouter: Router = Router();

directConversationRouter.use(requireAuth);

directConversationRouter.post(
    '/',
    validateRequest({ body: createDirectConversationBodySchema }),
    createDirectConversationHandler,
);
