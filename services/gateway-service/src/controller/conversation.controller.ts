import type { RequestHandler } from 'express';

import { type ConversationDto, chatProxyService } from '@/services/chat-proxy.service';
import { type UserSummaryDto, userProxyService } from '@/services/user-proxy.service';
import { getAuthenticatedUser } from '@/utils/auth';
import { logger } from '@/utils/logger';
import {
    createDirectConversationBodySchema,
    createConversationBodySchema,
    listConversationsQuerySchema,
    conversationIdParamsSchema,
} from '@/validation/conversation.schema';
import { asyncHandler, HttpError } from '@chatapp/common';
import { createMessageBodySchema, listMessagesQuerySchema } from '@/validation/message.schema';

const buildParticipantLookup = (
    users: UserSummaryDto[],
): Map<string, { id: string; displayName: string }> =>
    new Map(users.map((user) => [user.id, { id: user.id, displayName: user.displayName }]));

const withEmptyParticipants = (conversation: ConversationDto): ConversationDto => ({
    ...conversation,
    participants: [],
});

const hydrateConversation = (
    conversation: ConversationDto,
    participantLookup: Map<string, { id: string; displayName: string }>,
): ConversationDto => ({
    ...conversation,
    participants: conversation.participantIds
        .map((participantId) => participantLookup.get(participantId))
        .filter((participant): participant is { id: string; displayName: string } => participant !== undefined),
});

const hydrateSingleConversation = async (conversation: ConversationDto): Promise<ConversationDto> => {
    const users = (await userProxyService.getUsersByIds({
        ids: conversation.participantIds,
    })).data;
    return hydrateConversation(conversation, buildParticipantLookup(users));
};

const hydrateConversationList = async (conversations: ConversationDto[]): Promise<ConversationDto[]> => {
    const uniqueParticipantIds = Array.from(
        new Set(conversations.flatMap((conversation) => conversation.participantIds)),
    );
    const users = (await userProxyService.getUsersByIds({
        ids: uniqueParticipantIds,
    })).data;
    const lookup = buildParticipantLookup(users);
    return conversations.map((conversation) => hydrateConversation(conversation, lookup));
};

const safeHydrateSingleConversation = async (
    conversation: ConversationDto,
    context: { userId: string; requestId: string; flow: string },
): Promise<ConversationDto> => {
    try {
        return await hydrateSingleConversation(conversation);
    } catch (error) {
        logger.warn(
            {
                err: error,
                userId: context.userId,
                conversationId: conversation.id,
                participantCount: conversation.participantIds.length,
                requestId: context.requestId,
                flow: context.flow,
            },
            'Conversation hydration failed; returning fallback response',
        );
        return withEmptyParticipants(conversation);
    }
};

const safeHydrateConversationList = async (
    conversations: ConversationDto[],
    context: { userId: string; requestId: string; flow: string },
): Promise<ConversationDto[]> => {
    try {
        return await hydrateConversationList(conversations);
    } catch (error) {
        logger.warn(
            {
                err: error,
                userId: context.userId,
                conversationCount: conversations.length,
                requestId: context.requestId,
                flow: context.flow,
            },
            'Conversation list hydration failed; returning fallback response',
        );
        return conversations.map(withEmptyParticipants);
    }
};

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

    const hydratedConversation = await safeHydrateSingleConversation(conversation, {
        userId: user.id,
        requestId: 'createConversation',
        flow: 'createConversation',
    });

    res.status(201).json({ data: hydratedConversation });
});

export const createDirectConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const payload = createDirectConversationBodySchema.parse(req.body);

    if (payload.participantId === user.id) {
        throw new HttpError(400, 'Direct conversation must include another user');
    }

    await userProxyService.getUserById(payload.participantId);

    const conversation = await chatProxyService.createDirectConversation(user.id, payload);

    const hydratedConversation = await safeHydrateSingleConversation(conversation, {
        userId: user.id,
        requestId: 'createDirectConversation',
        flow: 'createDirectConversation',
    });

    res.status(200).json({ data: hydratedConversation });
});



export const listConversationsHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { participantId } = listConversationsQuerySchema.parse(req.query);

    if (participantId && participantId !== user.id) {
        throw new HttpError(403, 'Cannot list conversations for another user');
    }

    const conversations = await chatProxyService.listConversations(user.id);
    const hydratedConversations = await safeHydrateConversationList(conversations, {
        userId: user.id,
        requestId: 'listConversations',
        flow: 'listConversations',
    });

    res.json({ data: hydratedConversations });
});


export const getConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = conversationIdParamsSchema.parse(req.params);
    const conversation = await chatProxyService.getConversation(id, user.id);

    if (!conversation.participantIds.includes(user.id)) {
        throw new HttpError(403, 'You are not a participant in this conversation');
    }

    const hydratedConversation = await safeHydrateSingleConversation(conversation, {
        userId: user.id,
        requestId: 'getConversation',
        flow: 'getConversation',
    });

    res.json({ data: hydratedConversation });
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
    const messages = await chatProxyService.listMessages(id, user.id, {
        limit: query.limit,
        before: query.before,
        after: query.after,
    });
    res.json({ data: messages });
});
