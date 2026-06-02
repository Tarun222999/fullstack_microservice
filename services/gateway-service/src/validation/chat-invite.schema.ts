import { z } from '@chatapp/common';

const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    },
    { message: 'Invite URL must use http or https' },
  );

export const createChatInviteBodySchema = z.object({
  email: z.string().email(),
  inviteUrl: httpUrlSchema,
});

export type CreateChatInviteBody = z.infer<typeof createChatInviteBodySchema>;
