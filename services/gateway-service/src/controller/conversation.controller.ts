import type { RequestHandler } from 'express';

import { chatProxyService } from '@/services/chat-proxy.service';
import { userProxyService } from '@/services/user-proxy.service';
import { getAuthenticatedUser } from '@/utils/auth';
import {
    createDirectConversationBodySchema,
    createConversationBodySchema,
    listConversationsQuerySchema,
    conversationIdParamsSchema,
} from '@/validation/conversation.schema';
import { asyncHandler, HttpError } from '@chatapp/common';
import { createMessageBodySchema, listMessagesQuerySchema } from '@/validation/message.schema';

export const createConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const payload = createConversationBodySchema.parse(req.body);

    const uniqueParticipantIds = Array.from(new Set([...payload.participantIds, user.id]));

    if (uniqueParticipantIds.length < 2) {
        throw new HttpError(400, 'Conversation must atleast include one other participant');
    }

    const conversation = await chatProxyService.createConversation(user.id, {
        title: payload.title,
        participantIds: uniqueParticipantIds,
    });

    res.status(201).json({ data: conversation });
});

export const createDirectConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const payload = createDirectConversationBodySchema.parse(req.body);

    if (payload.participantId === user.id) {
        throw new HttpError(400, 'Direct conversation must include another user');
    }

    await userProxyService.getUserById(payload.participantId);

    const conversation = await chatProxyService.createDirectConversation(user.id, payload);

    res.status(200).json({ data: conversation });
});



export const listConversationsHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { participantId } = listConversationsQuerySchema.parse(req.query);

    if (participantId && participantId !== user.id) {
        throw new HttpError(403, 'Cannot list conversations for another user');
    }

    const conversations = await chatProxyService.listConversations(user.id);
    res.json({ data: conversations });
});


export const getConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = conversationIdParamsSchema.parse(req.params);
    const conversation = await chatProxyService.getConversation(id, user.id);

    if (!conversation.participantIds.includes(user.id)) {
        throw new HttpError(403, 'You are not a participant in this conversation');
    }

    res.json({ data: conversation });
});


export const createMessageHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = conversationIdParamsSchema.parse(req.params);
    const payload = createMessageBodySchema.parse(req.body);
    const message = await chatProxyService.createMessage(id, user.id, {
        body: payload.body,
    });
    res.status(201).json({ data: message });
});

export const listMessagesHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = conversationIdParamsSchema.parse(req.params);
    const query = listMessagesQuerySchema.parse(req.query);
    const messages = await chatProxyService.listMessages(id, user.id, query);
    res.json({ data: messages });
});
