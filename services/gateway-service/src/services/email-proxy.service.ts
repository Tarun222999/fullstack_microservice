import { HttpError } from '@chatapp/common';
import axios, { AxiosRequestConfig } from 'axios';

import { env } from '@/config/env';

const createClient = () => {
  const config: AxiosRequestConfig = {
    baseURL: env.EMAIL_SERVICE_URL,
    timeout: 5000,
    headers: {
      'X-Internal-Token': env.INTERNAL_API_TOKEN,
    },
  };

  return axios.create(config);
};

const client = createClient();

export interface SendChatInvitePayload {
  to: string;
  inviteUrl: string;
  inviterName?: string;
}

export interface SendChatInviteResponse {
  data: {
    id: string;
  };
}

const resolvedMessage = (status: number, data: unknown): string => {
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }

  return status >= 500
    ? 'Email service is unavailable'
    : 'An error occurred while processing the request';
};

const handleAxiosError = (error: unknown): never => {
  if (!axios.isAxiosError(error) || !error.response) {
    throw new HttpError(500, 'Email service is unavailable');
  }

  const { status, data } = error.response as { status: number; data: unknown };

  throw new HttpError(status, resolvedMessage(status, data));
};

export const emailProxyService = {
  async sendChatInvite(payload: SendChatInvitePayload): Promise<SendChatInviteResponse> {
    try {
      const response = await client.post<SendChatInviteResponse>('/emails/chat-invite', payload);
      return response.data;
    } catch (error) {
      return handleAxiosError(error);
    }
  },
};
