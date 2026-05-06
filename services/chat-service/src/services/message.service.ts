import type {
    Message,
    MessageListOptions,
} from '@/types/message';

import { messageRepository } from '@/repositories/message.repository';
import { conversationService } from '@/services/conversation.service';
import { HttpError } from '@chatapp/common';

export const messageService = {
    async createMessage(conversationId: string, senderId: string, body: string): Promise<Message> {
        // Ensure conversation exists before inserting the message
        const conversation = await conversationService.getConversationById(conversationId);

        if (!conversation.participantIds.includes(senderId)) {
            throw new HttpError(403, 'Sender is not part of this conversation');
        }

        const message = await messageRepository.create(conversationId, senderId, body);
        await conversationService.touchConversation(conversationId, body.slice(0, 120));

        return message;
    },

    async listMessages(
        conversationId: string,
        requesterId: string,
        options: MessageListOptions = {},
    ): Promise<Message[]> {
        // Ensure conversation exists; re-use conversation service for caching behavior
        const conversation = await conversationService.getConversationById(conversationId);

        if (!conversation.participantIds.includes(requesterId)) {
            throw new HttpError(403, 'Requester is not part of this conversation');
        }

        let beforeCursor: { id: string; createdAt: Date } | undefined;
        if (options.beforeMessageId) {
            const cursorMessage = await messageRepository.findById(options.beforeMessageId);
            if (!cursorMessage || cursorMessage.conversationId !== conversationId) {
                throw new HttpError(404, 'Message cursor not found');
            }

            beforeCursor = {
                id: cursorMessage.id,
                createdAt: cursorMessage.createdAt,
            };
        }

        return messageRepository.findByConversation(conversationId, {
            limit: options.limit,
            after: beforeCursor ? undefined : options.after,
            before: beforeCursor,
        });
    },
};
