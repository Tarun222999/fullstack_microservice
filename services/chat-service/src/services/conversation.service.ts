import { HttpError } from '@chatapp/common';
import type {
  Conversation,
  ConversationFilter,
  ConversationSummary,
  CreateConversationInput,
} from '@/types/conversation';

import { conversationCache } from '@/cache/conversation.cache';
import { conversationRepository } from '@/repositories/conversation.repository';

export const conversationService = {
  async createConversation(input: CreateConversationInput): Promise<Conversation> {
    const conversation = await conversationRepository.create({
      title: input.title,
      participantIds: input.participantIds,
      kind: 'group',
    });
    await conversationCache.set(conversation);
    return conversation;
  },

  async createOrGetDirectConversation(
    requesterId: string,
    otherUserId: string,
  ): Promise<Conversation> {
    if (requesterId === otherUserId) {
      throw new HttpError(400, 'Direct conversation must include another user');
    }

    const participantIds = [requesterId, otherUserId].sort();
    const directPairKey = participantIds.join(':');

    const existing = await conversationRepository.findDirectByPairKey(directPairKey);
    if (existing) {
      await conversationCache.set(existing);
      return existing;
    }

    const conversation = await conversationRepository.createOrGetDirect({
      title: null,
      participantIds,
      kind: 'direct',
      directPairKey,
    });

    await conversationCache.set(conversation);
    return conversation;
  },

  async getConversationById(id: string): Promise<Conversation> {
    const cached = await conversationCache.get(id);

    if (cached) {
      return cached;
    }

    const conversation = await conversationRepository.findById(id);

    if (!conversation) {
      throw new HttpError(404, 'Conversation Not Found');
    }

    await conversationCache.set(conversation);
    return conversation;
  },

  async listConversation(filter: ConversationFilter): Promise<ConversationSummary[]> {
    return conversationRepository.findSummaries(filter);
  },

  async touchConversation(conversationId: string, preview: string): Promise<void> {
    await conversationRepository.touchConversation(conversationId, preview);
    await conversationCache.delete(conversationId);
  },
};
