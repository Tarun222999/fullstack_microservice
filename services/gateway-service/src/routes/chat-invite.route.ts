import { createChatInviteHandler } from '@/controller/chat-invite.controller';
import { requireAuth } from '@/middleware/require-auth';
import { createChatInviteBodySchema } from '@/validation/chat-invite.schema';
import { validateRequest } from '@chatapp/common';
import { Router } from 'express';

export const chatInviteRouter: Router = Router();

chatInviteRouter.use(requireAuth);

chatInviteRouter.post(
  '/',
  validateRequest({ body: createChatInviteBodySchema }),
  createChatInviteHandler,
);
