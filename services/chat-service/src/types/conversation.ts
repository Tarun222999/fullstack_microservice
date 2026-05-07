export type ConversationKind = 'direct' | 'group';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string | null;
  participantIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
}

export interface CreateConversationInput {
  title?: string | null;
  participantIds: string[];
  kind?: ConversationKind;
  directPairKey?: string;
}

export interface ConversationFilter {
  participantId: string;
}

export type ConversationSummary = Conversation;
