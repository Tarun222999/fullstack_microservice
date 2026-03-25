import { z } from '@chatapp/common';

export const createMessageBodySchema = z.object({
    body: z.string().min(1).max(2000),
});

export const listMessagesQuerySchema = z.object({
    limit: z
        .preprocess(
            (value) => (value === undefined ? undefined : Number(value)),
            z.number().int().min(1).max(200),
        )
        .optional(),
    before: z.string().uuid().optional(),
    after: z.string().datetime().optional(),
});
