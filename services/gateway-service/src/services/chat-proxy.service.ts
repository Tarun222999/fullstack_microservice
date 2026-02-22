import { HttpError, USER_ID_HEADER } from '@chatapp/common';
import axios, { AxiosRequestConfig } from 'axios';

import { env } from '@/config/env';

const createClient = () => {
    const config: AxiosRequestConfig = {
        baseURL: env.CHAT_SERVICE_URL,
        timeout: 5000,
        headers: {
            'X-Internal-Token': env.INTERNAL_API_TOKEN,
        },
    };

    return axios.create(config);
};

const client = createClient();

const resolvedMessage = (status: number, data: unknown): string => {
    if (typeof data === 'object' && data && 'message' in data) {
        const message = (data as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim().length > 0) {
            return message;
        }
    }

    return status >= 500
        ? 'Authentication service is unavailable'
        : 'An error occurred while processing the request';
};

const handleAxiosError = (error: unknown): never => {
    if (!axios.isAxiosError(error) || !error.response) {
        throw new HttpError(500, 'Authentication service is unavailable');
    }

    const { status, data } = error.response as { status: number; data: unknown };

    throw new HttpError(status, resolvedMessage(status, data));
};


export interface ConversationDto {
    id: string;
    title: string | null;
    participantIds: string[];
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
}


export interface ReactionDto {
    emoji: string;
    userId: string;
    createdAt: string;
}

export interface MessageDto {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: string;
    reactions: ReactionDto[];
}

export interface ConversationResponse {
    data: ConversationDto;
}

export interface ConversationListResponse {
    data: ConversationDto[];
}

export interface MessageResponse {
    data: MessageDto;
}

export interface MessageListResponse {
    data: MessageDto[];
}

export interface CreateConversationPayload {
    title?: string | null;
    participantIds: string[];
}

export interface CreateMessagePayload {
    body: string;
}


export const chatProxyService = {

    async createConversation(
        userId: string,
        payload: CreateConversationPayload,
    ): Promise<ConversationDto> {
        try {
            const response = await client.post<ConversationResponse>('/conversations', payload, {
                headers: { [USER_ID_HEADER]: userId },
            });
            return response.data.data;
        } catch (error) {

            return handleAxiosError(error);
        }
    },


    async listConversations(userId: string): Promise<ConversationDto[]> {
        try {
            const response = await client.get<ConversationListResponse>('/conversations', {
                headers: { [USER_ID_HEADER]: userId },
            });
            return response.data.data;
        } catch (error) {
            console.log("error in list", error)
            return handleAxiosError(error);
        }
    },

    async getConversation(id: string, userId: string): Promise<ConversationDto> {
        try {
            const response = await client.get<ConversationResponse>(`/conversations/${id}`, {
                headers: { [USER_ID_HEADER]: userId },
            });
            return response.data.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async createMessage(
        conversationId: string,
        userId: string,
        payload: CreateMessagePayload,
    ): Promise<MessageDto> {
        try {
            const response = await client.post<MessageResponse>(
                `/conversations/${conversationId}/messages`,
                payload,
                {
                    headers: { [USER_ID_HEADER]: userId },
                },
            );
            return response.data.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async listMessages(
        conversationId: string,
        userId: string,
        query: { limit?: number; after?: string },
    ): Promise<MessageDto[]> {
        try {
            const response = await client.get<MessageListResponse>(
                `/conversations/${conversationId}/messages`,
                {
                    params: query,
                    headers: { [USER_ID_HEADER]: userId },
                },
            );
            return response.data.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },
};