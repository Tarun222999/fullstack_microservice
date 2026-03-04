import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@chatapp/common';

const messageRepositoryMocks = vi.hoisted(() => ({
    create: vi.fn(),
    findByConversation: vi.fn(),
}));

const conversationServiceMocks = vi.hoisted(() => ({
    getConversationById: vi.fn(),
    touchConversation: vi.fn(),
}));

vi.mock('@/repositories/message.repository', () => ({
    messageRepository: messageRepositoryMocks,
}));

vi.mock('@/services/conversation.service', () => ({
    conversationService: conversationServiceMocks,
}));

import { messageService } from '@/services/message.service';

describe('messageService', () => {
    it('creates message when sender is a participant', async () => {
        conversationServiceMocks.getConversationById.mockResolvedValue({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            title: 'Dev chat',
            participantIds: [
                'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
                '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
            ],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            lastMessageAt: null,
            lastMessagePreview: null,
        });

        const createdMessage = {
            id: 'dcaf983e-2ab0-42ec-bf50-d7af5f344dbf',
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            senderId: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            body: 'Hello team',
            createdAt: new Date('2026-01-01T00:01:00.000Z'),
            reactions: [],
        };
        messageRepositoryMocks.create.mockResolvedValue(createdMessage);
        conversationServiceMocks.touchConversation.mockResolvedValue(undefined);

        const result = await messageService.createMessage(
            '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            'Hello team',
        );

        expect(result).toEqual(createdMessage);
        expect(messageRepositoryMocks.create).toHaveBeenCalledWith(
            '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            'Hello team',
        );
        expect(conversationServiceMocks.touchConversation).toHaveBeenCalledWith(
            '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            'Hello team',
        );
    });

    it('throws 403 when sender is not a participant', async () => {
        conversationServiceMocks.getConversationById.mockResolvedValue({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            title: null,
            participantIds: ['936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            lastMessageAt: null,
            lastMessagePreview: null,
        });

        await expect(
            messageService.createMessage(
                '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
                'Hello team',
            ),
        ).rejects.toThrowError(HttpError);

        expect(messageRepositoryMocks.create).not.toHaveBeenCalled();
        expect(conversationServiceMocks.touchConversation).not.toHaveBeenCalled();
    });

    it('lists messages for participants only', async () => {
        conversationServiceMocks.getConversationById.mockResolvedValue({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            title: 'Dev chat',
            participantIds: ['dc40ca49-b0f2-4b27-a771-5fda47d1d66f'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            lastMessageAt: null,
            lastMessagePreview: null,
        });

        const messages = [
            {
                id: 'dcaf983e-2ab0-42ec-bf50-d7af5f344dbf',
                conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                senderId: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
                body: 'Hello team',
                createdAt: new Date('2026-01-01T00:01:00.000Z'),
                reactions: [],
            },
        ];
        messageRepositoryMocks.findByConversation.mockResolvedValue(messages);

        const result = await messageService.listMessages(
            '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            { limit: 20 },
        );

        expect(result).toEqual(messages);
        expect(messageRepositoryMocks.findByConversation).toHaveBeenCalledWith(
            '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            { limit: 20 },
        );
    });

    it('rejects listing when requester is not a participant', async () => {
        conversationServiceMocks.getConversationById.mockResolvedValue({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            title: null,
            participantIds: ['936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            lastMessageAt: null,
            lastMessagePreview: null,
        });

        await expect(
            messageService.listMessages(
                '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
                {},
            ),
        ).rejects.toThrowError(HttpError);
    });
});
