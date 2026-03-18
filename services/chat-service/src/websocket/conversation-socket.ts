import { HttpError, z } from '@chatapp/common';
import type { Socket } from 'socket.io';

import { conversationService } from '@/services/conversation.service';
import { messageService } from '@/services/message.service';
import { logger } from '@/utils/logger';

const conversationJoinSchema = z.object({
    conversationId: z.string().uuid(),
});

const messageSendSchema = z.object({
    conversationId: z.string().uuid(),
    body: z.string().min(1).max(4_000),
    clientMessageId: z.string().min(1).max(128).optional(),
});

const toMessageErrorContext = (payload: unknown): {
    conversationId?: string;
    clientMessageId?: string;
} => {
    if (!payload || typeof payload !== 'object') {
        return {};
    }

    const rawPayload = payload as Record<string, unknown>;

    return {
        ...(typeof rawPayload.conversationId === 'string'
            ? { conversationId: rawPayload.conversationId }
            : {}),
        ...(typeof rawPayload.clientMessageId === 'string'
            ? { clientMessageId: rawPayload.clientMessageId }
            : {}),
    };
};

const conversationRoom = (conversationId: string) => `conversation:${conversationId}`;

export const registerConversationSocketHandlers = (socket: Socket): void => {
    socket.on('conversation:join', async (payload, acknowledge) => {
        try {
            const { conversationId } = conversationJoinSchema.parse(payload);
            const conversation = await conversationService.getConversationById(conversationId);

            if (!conversation.participantIds.includes(socket.data.user.id)) {
                throw new HttpError(403, 'Unauthorized');
            }

            const room = conversationRoom(conversationId);
            socket.join(room);

            logger.info(
                { socketId: socket.id, userId: socket.data.user.id, conversationId, room },
                'Joined conversation room',
            );

            acknowledge?.({ ok: true, conversationId });
        } catch (error) {
            const message = error instanceof HttpError ? error.message : 'Unable to join conversation';
            logger.warn(
                {
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                    err: error,
                },
                'Failed to join conversation room',
            );
            acknowledge?.({ ok: false, error: message });
        }
    });

    socket.on('conversation:leave', async (payload, acknowledge) => {
        try {
            const { conversationId } = conversationJoinSchema.parse(payload);
            const room = conversationRoom(conversationId);
            socket.leave(room);

            logger.info(
                { socketId: socket.id, userId: socket.data.user.id, conversationId, room },
                'Left conversation room',
            );

            acknowledge?.({ ok: true, conversationId });
        } catch (error) {
            const message = error instanceof HttpError ? error.message : 'Unable to leave conversation';
            logger.warn(
                {
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                    err: error,
                },
                'Failed to leave conversation room',
            );
            acknowledge?.({ ok: false, error: message });
        }
    });

    socket.on('message:send', async (payload, acknowledge) => {
        const parsedPayload = messageSendSchema.safeParse(payload);
        const errorContext = toMessageErrorContext(payload);

        try {
            const { conversationId, body, clientMessageId } = messageSendSchema.parse(payload);
            const message = await messageService.createMessage(
                conversationId,
                socket.data.user.id,
                body,
            );
            const room = conversationRoom(conversationId);

            socket.to(room).emit('message:new', { message });
            socket.emit('message:new', { message });

            logger.info(
                {
                    socketId: socket.id,
                    userId: socket.data.user.id,
                    conversationId,
                    messageId: message.id,
                },
                'Sent realtime message',
            );

            acknowledge?.({
                ok: true,
                conversationId,
                messageId: message.id,
                ...(clientMessageId ? { clientMessageId } : {}),
            });
        } catch (error) {
            const message = error instanceof HttpError ? error.message : 'Failed to send message';

            logger.warn(
                {
                    socketId: socket.id,
                    userId: socket.data.user?.id,
                    conversationId: parsedPayload.success
                        ? parsedPayload.data.conversationId
                        : errorContext.conversationId,
                    err: error,
                },
                'Failed to send realtime message',
            );

            const errorPayload = {
                error: message,
                ...(parsedPayload.success
                    ? { conversationId: parsedPayload.data.conversationId }
                    : errorContext.conversationId
                        ? { conversationId: errorContext.conversationId }
                        : {}),
                ...(parsedPayload.success && parsedPayload.data.clientMessageId
                    ? { clientMessageId: parsedPayload.data.clientMessageId }
                    : errorContext.clientMessageId
                        ? { clientMessageId: errorContext.clientMessageId }
                        : {}),
            };

            socket.emit('message:error', errorPayload);
            acknowledge?.({
                ok: false,
                ...errorPayload,
            });
        }
    });
};

export { conversationRoom };
