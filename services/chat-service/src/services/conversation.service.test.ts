import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@chatapp/common';

const repositoryMocks = vi.hoisted(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    findSummaries: vi.fn(),
    touchConversation: vi.fn(),
}));

const cacheMocks = vi.hoisted(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
}));

vi.mock('@/repositories/conversation.repository', () => ({
    conversationRepository: repositoryMocks,
}));

vi.mock('@/cache/conversation.cache', () => ({
    conversationCache: cacheMocks,
}));

import { conversationService } from '@/services/conversation.service';

describe('conversationService', () => {
    it('creates a conversation and caches it', async () => {
        const conversation = {
            id: '2d87537f-e3e3-4fe8-9e9d-2579ec8a9030',
            title: 'Team chat',
            participantIds: [
                'f2f8a215-b679-45e7-a8f6-c421d3f6db95',
                '7f6dbf4d-b0ac-4d81-9dc3-9f8d2bd8be7f',
            ],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            lastMessageAt: null,
            lastMessagePreview: null,
        };

        repositoryMocks.create.mockResolvedValue(conversation);

        const result = await conversationService.createConversation({
            title: 'Team chat',
            participantIds: conversation.participantIds,
        });

        expect(result).toEqual(conversation);
        expect(repositoryMocks.create).toHaveBeenCalledTimes(1);
        expect(cacheMocks.set).toHaveBeenCalledWith(conversation);
    });

    it('returns cached conversation before reading repository', async () => {
        const cachedConversation = {
            id: 'd2a3679d-1389-4eb2-b52b-574fcdb3094c',
            title: 'Cached chat',
            participantIds: ['6f5efcb8-d0ce-4f38-8d4c-85ac282f0bcb'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            lastMessageAt: null,
            lastMessagePreview: null,
        };

        cacheMocks.get.mockResolvedValue(cachedConversation);

        const result = await conversationService.getConversationById(cachedConversation.id);

        expect(result).toEqual(cachedConversation);
        expect(repositoryMocks.findById).not.toHaveBeenCalled();
    });

    it('throws 404 when conversation does not exist', async () => {
        cacheMocks.get.mockResolvedValue(null);
        repositoryMocks.findById.mockResolvedValue(null);

        await expect(
            conversationService.getConversationById('46e8f8c4-2f65-4cc8-a6ca-58cc4e378345'),
        ).rejects.toThrowError(HttpError);

        await expect(
            conversationService.getConversationById('46e8f8c4-2f65-4cc8-a6ca-58cc4e378345'),
        ).rejects.toThrow('Conversation Not Found');
    });

    it('touches repository and invalidates cache', async () => {
        repositoryMocks.touchConversation.mockResolvedValue(undefined);
        cacheMocks.delete.mockResolvedValue(undefined);

        await conversationService.touchConversation(
            '268534da-bfea-4b38-8d22-15f9f4fdbb5a',
            'Latest preview',
        );

        expect(repositoryMocks.touchConversation).toHaveBeenCalledWith(
            '268534da-bfea-4b38-8d22-15f9f4fdbb5a',
            'Latest preview',
        );
        expect(cacheMocks.delete).toHaveBeenCalledWith('268534da-bfea-4b38-8d22-15f9f4fdbb5a');
    });
});
