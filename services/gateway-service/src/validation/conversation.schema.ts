import { z } from '@chatapp/common';

export const createConversationBodySchema = z.object({
    title: z.string().min(1).max(200).optional(),
    participantIds: z.array(z.string().uuid()).min(1),
});

export const createDirectConversationBodySchema = z.object({
    participantId: z.string().uuid(),
});

export const listConversationsQuerySchema = z.object({
    participantId: z.string().uuid().optional(),
});

export const conversationIdParamsSchema = z.object({
    id: z.string().uuid(),
});
