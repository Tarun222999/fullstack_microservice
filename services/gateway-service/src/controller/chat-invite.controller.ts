import type { RequestHandler } from 'express';

import { emailProxyService } from '@/services/email-proxy.service';
import {
  type CreateChatInviteBody,
  createChatInviteBodySchema,
} from '@/validation/chat-invite.schema';
import { getAuthenticatedUser } from '@/utils/auth';
import { asyncHandler } from '@chatapp/common';

export const createChatInviteHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const payload = createChatInviteBodySchema.parse(req.body) as CreateChatInviteBody;

  await emailProxyService.sendChatInvite({
    to: payload.email,
    inviteUrl: payload.inviteUrl,
    ...(user.email ? { inviterName: user.email } : {}),
  });

  res.status(200).json({
    data: {
      sent: true,
    },
  });
});
