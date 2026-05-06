import { z } from '@chatapp/common';

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
});
