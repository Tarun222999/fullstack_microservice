import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getChatDbRuntime } from '@/test/db-runtime';

describe('conversationRepository db integration', () => {
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

    it('creates and finds conversation by id', async (context) => {
        if (!runtime.available) {
            context.skip();
        }

        const created = await runtime.conversationRepository.create({
            title: 'Repo Chat',
            participantIds: [
                'ea43bfde-4aab-4215-990a-927da133b6ce',
                '112f8d72-4ed6-4bf1-be77-85db63e03a39',
            ],
        });

        const found = await runtime.conversationRepository.findById(created.id);

        expect(found).not.toBeNull();
        expect(found.title).toBe('Repo Chat');
        expect(found.participantIds).toHaveLength(2);
    });

    it('lists conversation summaries for participant', async (context) => {
        if (!runtime.available) {
            context.skip();
        }

        const participantId = 'ea43bfde-4aab-4215-990a-927da133b6ce';
        await runtime.conversationRepository.create({
            title: 'One',
            participantIds: [participantId, '112f8d72-4ed6-4bf1-be77-85db63e03a39'],
        });
        await runtime.conversationRepository.create({
            title: 'Two',
            participantIds: [participantId, '2a4fc53c-18aa-40f4-ae35-c28f9f9cf4fa'],
        });

        const list = await runtime.conversationRepository.findSummaries({ participantId });

        expect(list).toHaveLength(2);
    });
});
