import { asyncHandler, HttpError } from '@chatapp/common';
import type { RequestHandler } from 'express';
import { conversationService } from '@/services/conversation.service';
import {
  createConversationSchema,
  createDirectConversationSchema,
  listConversationsQuerySchema,
} from '@/validation/conversation.schema';
import { conversationIdParamsSchema } from '@/validation/shared.schema';
import { getAuthenticatedUser } from '@/utils/auth';
import { createMessageBodySchema, listMessagesQuerySchema } from '@/validation/message.schema';
import { messageService } from '@/services/message.service';

const parsedConversation = (params: unknown) => {
  const { id } = conversationIdParamsSchema.parse(params);
  return id;
};

export const createConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const payload = createConversationSchema.parse(req.body);
  const uniqueParticipantIds = Array.from(new Set([...payload.participantIds, user.id]));
  if (uniqueParticipantIds.length < 2) {
    throw new HttpError(400, 'Conversation must atleast include one other participant');
  }

  const conversation = await conversationService.createConversation({
    title: payload.title,
    participantIds: uniqueParticipantIds,
  });

  res.status(201).json({ data: conversation });
});

export const createDirectConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const payload = createDirectConversationSchema.parse(req.body);

  if (payload.participantId === user.id) {
    throw new HttpError(400, 'Direct conversation must include another user');
  }

  const conversation = await conversationService.createOrGetDirectConversation(
    user.id,
    payload.participantId,
  );

  res.status(200).json({ data: conversation });
});

export const listConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const filter = listConversationsQuerySchema.parse(req.query);
  if (filter.participantId && filter.participantId !== user.id) {
    throw new HttpError(403, 'Unauthorized');
  }
  const conversations = await conversationService.listConversation({ participantId: user.id });
  res.status(201).json({ data: conversations });
});

export const getConversationHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const conversationId = parsedConversation(req.params);
  const conversation = await conversationService.getConversationById(conversationId);

  if (!conversation.participantIds.includes(user.id)) {
    throw new HttpError(403, 'Unauthorized');
  }

  res.status(201).json({ data: conversation });
});

export const createMessageHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const conversationId = parsedConversation(req.params);
  const payload = createMessageBodySchema.parse(req.body);
  const message = await messageService.createMessage(conversationId, user.id, payload.body);
  res.status(201).json({ data: message });
});

export const listMessageHandler: RequestHandler = asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req);
  const conversationId = parsedConversation(req.params);
  const query = listMessagesQuerySchema.parse(req.query);
  const after = query.after ? new Date(query.after) : undefined;
  const messages = await messageService.listMessages(conversationId, user.id, {
    limit: query.limit,
    beforeMessageId: query.before,
    after,
  });
  res.json({ data: messages });
});
