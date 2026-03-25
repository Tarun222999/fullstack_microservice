import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getChatDbRuntime } from '@/test/db-runtime';

describe('messageRepository db integration', () => {
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

    it('creates messages and lists them by conversation in reverse chronological order', async (context) => {
        if (!runtime.available) {
            context.skip();
        }

        const conversation = await runtime.conversationRepository.create({
            title: 'Message Repo Chat',
            participantIds: [
                'ea43bfde-4aab-4215-990a-927da133b6ce',
                '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            ],
        });

        await runtime.messageRepository.create(
            conversation.id,
            'ea43bfde-4aab-4215-990a-927da133b6ce',
            'first',
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
        const second = await runtime.messageRepository.create(
            conversation.id,
            '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            'second',
        );

        const list = await runtime.messageRepository.findByConversation(conversation.id, {
            limit: 10,
        });

        expect(list).toHaveLength(2);
        expect(list[0].id).toBe(second.id);
        expect(list[0].body).toBe('second');
    });

    it('lists older messages when a before cursor is provided', async (context) => {
        if (!runtime.available) {
            context.skip();
        }

        const conversation = await runtime.conversationRepository.create({
            title: 'Message Repo Chat',
            participantIds: [
                'ea43bfde-4aab-4215-990a-927da133b6ce',
                '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            ],
        });

        const first = await runtime.messageRepository.create(
            conversation.id,
            'ea43bfde-4aab-4215-990a-927da133b6ce',
            'first',
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
        const second = await runtime.messageRepository.create(
            conversation.id,
            '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            'second',
        );
        await new Promise((resolve) => setTimeout(resolve, 10));
        const third = await runtime.messageRepository.create(
            conversation.id,
            'ea43bfde-4aab-4215-990a-927da133b6ce',
            'third',
        );

        const list = await runtime.messageRepository.findByConversation(conversation.id, {
            limit: 10,
            before: {
                id: third.id,
                createdAt: third.createdAt,
            },
        });

        expect(list).toHaveLength(2);
        expect(list[0].id).toBe(second.id);
        expect(list[1].id).toBe(first.id);
    });
});
