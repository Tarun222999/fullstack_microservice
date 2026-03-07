import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HttpError } from '@chatapp/common';
import { getChatDbRuntime } from '@/test/db-runtime';

describe('messageService db integration', () => {
    let runtime: Awaited<ReturnType<typeof getChatDbRuntime>>;

    beforeAll(async () => {
        runtime = await getChatDbRuntime();
    });

    afterEach(async () => {
        if (!runtime.available) {
            return;
        }
        await runtime.reset?.();
    });

    afterAll(async () => {
        if (!runtime.available) {
            return;
        }
        await runtime.cleanup?.();
    });

    it('createMessage enforces participant membership and updates conversation preview', async (context) => {
        if (!runtime.available) {
            context.skip();
        }

        const conversation = await runtime.conversationRepository.create({
            title: 'Message Service Chat',
            participantIds: [
                'ea43bfde-4aab-4215-990a-927da133b6ce',
                '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            ],
        });

        await expect(
            runtime.messageService.createMessage(
                conversation.id,
                '2a4fc53c-18aa-40f4-ae35-c28f9f9cf4fa',
                'No permission',
            ),
        ).rejects.toThrowError(HttpError);

        const created = await runtime.messageService.createMessage(
            conversation.id,
            'ea43bfde-4aab-4215-990a-927da133b6ce',
            'Allowed message',
        );

        expect(created.body).toBe('Allowed message');

        const refreshed = await runtime.conversationRepository.findById(conversation.id);
        expect(refreshed.lastMessagePreview).toBe('Allowed message');
    });

    it('listMessages enforces membership and applies options', async (context) => {
        if (!runtime.available) {
            context.skip();
        }

        const conversation = await runtime.conversationRepository.create({
            title: 'List Message Chat',
            participantIds: [
                'ea43bfde-4aab-4215-990a-927da133b6ce',
                '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            ],
        });

        await runtime.messageRepository.create(
            conversation.id,
            'ea43bfde-4aab-4215-990a-927da133b6ce',
            'old message',
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
        const newer = await runtime.messageRepository.create(
            conversation.id,
            '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            'new message',
        );

        await expect(
            runtime.messageService.listMessages(
                conversation.id,
                '2a4fc53c-18aa-40f4-ae35-c28f9f9cf4fa',
                { limit: 10 },
            ),
        ).rejects.toThrowError(HttpError);

        const limited = await runtime.messageService.listMessages(
            conversation.id,
            'ea43bfde-4aab-4215-990a-927da133b6ce',
            { limit: 1 },
        );
        expect(limited).toHaveLength(1);
        expect(limited[0].id).toBe(newer.id);
    });
});
