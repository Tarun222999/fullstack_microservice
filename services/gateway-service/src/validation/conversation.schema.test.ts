import { describe, expect, it } from 'vitest';
import {
    conversationIdParamsSchema,
    createConversationBodySchema,
    createDirectConversationBodySchema,
    listConversationsQuerySchema,
} from '@/validation/conversation.schema';

describe('conversation schema', () => {
    it('accepts a valid create conversation payload', () => {
        const payload = {
            title: 'Project chat',
            participantIds: ['6d36fffd-9f1f-48ce-9d68-fc85501f9cf6'],
        };

        const parsed = createConversationBodySchema.parse(payload);

        expect(parsed.title).toBe('Project chat');
        expect(parsed.participantIds).toHaveLength(1);
    });

    it('rejects create payload when participantIds is empty', () => {
        expect(() =>
            createConversationBodySchema.parse({
                title: 'Invalid',
                participantIds: [],
            }),
        ).toThrow();
    });

    it('accepts a valid create direct conversation payload', () => {
        const parsed = createDirectConversationBodySchema.parse({
            participantId: '6d36fffd-9f1f-48ce-9d68-fc85501f9cf6',
        });

        expect(parsed.participantId).toBe('6d36fffd-9f1f-48ce-9d68-fc85501f9cf6');
    });

    it('accepts list query with optional participantId', () => {
        const parsed = listConversationsQuerySchema.parse({
            participantId: 'e0f63d4c-dde0-45a3-8f72-6e23a1ec36c5',
        });

        expect(parsed.participantId).toBe('e0f63d4c-dde0-45a3-8f72-6e23a1ec36c5');
    });

    it('validates conversation id params', () => {
        const parsed = conversationIdParamsSchema.parse({
            id: '9e7813ee-40e4-4409-bf98-2bde89be0a53',
        });

        expect(parsed.id).toBe('9e7813ee-40e4-4409-bf98-2bde89be0a53');
    });
});
