

export interface Conversation {
    id: string;
    title: string | null
    participantIds: string[];
    createdAt: Date;
    updatedAt: Date;
    lastMessageAt: Date | null;
    lastMessagePreview: string | null;
}


export interface CreateConversationInput {
    title?: string | null;
    participantIds: string[];
}

export interface ConversationFilter {
    participantId: string;
}

export type ConversationSummary = Conversation;