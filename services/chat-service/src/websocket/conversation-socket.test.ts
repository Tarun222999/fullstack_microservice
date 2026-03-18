import { beforeEach, describe, expect, it, vi } from 'vitest';

const conversationServiceMocks = vi.hoisted(() => ({
    getConversationById: vi.fn(),
}));

const messageServiceMocks = vi.hoisted(() => ({
    createMessage: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));

vi.mock('@/services/conversation.service', () => ({
    conversationService: conversationServiceMocks,
}));

vi.mock('@/services/message.service', () => ({
    messageService: messageServiceMocks,
}));

vi.mock('@/utils/logger', () => ({
    logger: loggerMocks,
}));

import {
    conversationRoom,
    registerConversationSocketHandlers,
} from '@/websocket/conversation-socket';

describe('conversation socket handlers', () => {
    const socketHandlers = new Map<string, (...args: unknown[]) => void>();

    beforeEach(() => {
        socketHandlers.clear();
        vi.clearAllMocks();
    });

    const createSocket = () => ({
        id: 'socket-1',
        data: {
            user: {
                id: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            },
        },
        join: vi.fn(),
        leave: vi.fn(),
        emit: vi.fn(),
        to: vi.fn(() => ({
            emit: vi.fn(),
        })),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            socketHandlers.set(event, handler);
        }),
    });

    it('joins a conversation room for a participant', async () => {
        const socket = createSocket();
        conversationServiceMocks.getConversationById.mockResolvedValue({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            kind: 'direct',
            title: null,
            participantIds: [
                'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
                '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessageAt: null,
            lastMessagePreview: null,
        });

        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('conversation:join')?.(
            { conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4' },
            acknowledge,
        );

        expect(socket.join).toHaveBeenCalledWith('conversation:7af7345f-5419-47f1-b1a3-f25e31e0f1e4');
        expect(acknowledge).toHaveBeenCalledWith({
            ok: true,
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
        });
    });

    it('rejects joining when user is not a participant', async () => {
        const socket = createSocket();
        conversationServiceMocks.getConversationById.mockResolvedValue({
            id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            kind: 'group',
            title: 'Project',
            participantIds: ['936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
            createdAt: new Date(),
            updatedAt: new Date(),
            lastMessageAt: null,
            lastMessagePreview: null,
        });

        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('conversation:join')?.(
            { conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4' },
            acknowledge,
        );

        expect(socket.join).not.toHaveBeenCalled();
        expect(acknowledge).toHaveBeenCalledWith({
            ok: false,
            error: 'Unauthorized',
        });
    });

    it('leaves a conversation room', async () => {
        const socket = createSocket();
        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('conversation:leave')?.(
            { conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4' },
            acknowledge,
        );

        expect(socket.leave).toHaveBeenCalledWith('conversation:7af7345f-5419-47f1-b1a3-f25e31e0f1e4');
        expect(acknowledge).toHaveBeenCalledWith({
            ok: true,
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
        });
    });

    it('exports the stable conversation room naming convention', () => {
        expect(conversationRoom('7af7345f-5419-47f1-b1a3-f25e31e0f1e4')).toBe(
            'conversation:7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
        );
    });

    it('persists a message before emitting realtime fanout and ack', async () => {
        const socket = createSocket();
        const roomEmitter = vi.fn();
        socket.to.mockReturnValue({ emit: roomEmitter });
        messageServiceMocks.createMessage.mockResolvedValue({
            id: '11111111-2222-3333-4444-555555555555',
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            senderId: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            body: 'Hello there',
            createdAt: new Date('2026-01-01T00:01:00.000Z'),
            reactions: [],
        });

        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('message:send')?.(
            {
                conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                body: 'Hello there',
                clientMessageId: 'client-1',
            },
            acknowledge,
        );

        expect(messageServiceMocks.createMessage).toHaveBeenCalledWith(
            '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
            'Hello there',
        );
        expect(socket.to).toHaveBeenCalledWith('conversation:7af7345f-5419-47f1-b1a3-f25e31e0f1e4');
        expect(roomEmitter).toHaveBeenCalledWith('message:new', {
            message: expect.objectContaining({
                id: '11111111-2222-3333-4444-555555555555',
            }),
        });
        expect(socket.emit).toHaveBeenCalledWith('message:new', {
            message: expect.objectContaining({
                id: '11111111-2222-3333-4444-555555555555',
            }),
        });
        expect(acknowledge).toHaveBeenCalledWith({
            ok: true,
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            messageId: '11111111-2222-3333-4444-555555555555',
            clientMessageId: 'client-1',
        });
    });

    it('emits message:error and negative ack on send failure', async () => {
        const socket = createSocket();
        messageServiceMocks.createMessage.mockRejectedValue(
            new Error('Sender is not part of this conversation'),
        );

        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('message:send')?.(
            {
                conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                body: 'Hello there',
                clientMessageId: 'client-1',
            },
            acknowledge,
        );

        expect(socket.emit).toHaveBeenCalledWith('message:error', {
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            clientMessageId: 'client-1',
            error: 'Failed to send message',
        });
        expect(acknowledge).toHaveBeenCalledWith({
            ok: false,
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            clientMessageId: 'client-1',
            error: 'Failed to send message',
        });
    });

    it('rejects message:send when conversationId is not a valid uuid', async () => {
        const socket = createSocket();
        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('message:send')?.(
            {
                conversationId: 'invalid-id',
                body: 'Hello there',
                clientMessageId: 'client-1',
            },
            acknowledge,
        );

        expect(messageServiceMocks.createMessage).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('message:error', {
            conversationId: 'invalid-id',
            clientMessageId: 'client-1',
            error: 'Failed to send message',
        });
        expect(acknowledge).toHaveBeenCalledWith({
            ok: false,
            conversationId: 'invalid-id',
            clientMessageId: 'client-1',
            error: 'Failed to send message',
        });
    });

    it('rejects message:send when body is empty', async () => {
        const socket = createSocket();
        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('message:send')?.(
            {
                conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                body: '',
                clientMessageId: 'client-1',
            },
            acknowledge,
        );

        expect(messageServiceMocks.createMessage).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('message:error', {
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            clientMessageId: 'client-1',
            error: 'Failed to send message',
        });
        expect(acknowledge).toHaveBeenCalledWith({
            ok: false,
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            clientMessageId: 'client-1',
            error: 'Failed to send message',
        });
    });

    it('rejects message:send when body or clientMessageId exceed limits', async () => {
        const socket = createSocket();
        registerConversationSocketHandlers(socket as never);

        const acknowledge = vi.fn();
        await socketHandlers.get('message:send')?.(
            {
                conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
                body: 'a'.repeat(4_001),
                clientMessageId: 'c'.repeat(129),
            },
            acknowledge,
        );

        expect(messageServiceMocks.createMessage).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith('message:error', {
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            clientMessageId: 'c'.repeat(129),
            error: 'Failed to send message',
        });
        expect(acknowledge).toHaveBeenCalledWith({
            ok: false,
            conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
            clientMessageId: 'c'.repeat(129),
            error: 'Failed to send message',
        });
    });
});
