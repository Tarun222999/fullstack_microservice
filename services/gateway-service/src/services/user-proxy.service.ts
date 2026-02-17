import { HttpError } from '@chatapp/common';
import axios from 'axios';

import { env } from '@/config/env';

const client = axios.create({
    baseURL: env.USER_SERVICE_URL,
    timeout: 5000,
});

const authHeader = {
    headers: {
        'X-Internal-Token': env.INTERNAL_API_TOKEN,
    },
} as const;


export interface UserDto {
    id: string;
    email: string;
    displayName: string;
    createdAt: string;
    updatedAt: string;
}

export interface UserResponse {
    data: UserDto;
}

export interface UserLisResponse {
    data: UserDto[];
}

export interface CreateUserPayload {
    email: string;
    displayName: string;
}

export interface SearchUsersParams {
    query: string;
    limit?: number;
    exclude?: string[];
}


const resolvedMessage = (status: number, data: unknown): string => {
    if (typeof data === 'object' && data && 'message' in data) {
        const message = (data as Record<string, unknown>).message;
        if (typeof message === 'string' && message.trim().length > 0) {
            return message;
        }
    }

    return status >= 500
        ? 'UserService service is unavailable'
        : 'An error occurred while processing the request';
};


const handleAxiosError = (error: unknown): never => {
    if (!axios.isAxiosError(error) || !error.response) {
        throw new HttpError(500, 'UserService service is unavailable');
    }

    const { status, data } = error.response as { status: number; data: unknown };

    throw new HttpError(status, resolvedMessage(status, data));
};

export const userProxyService = {
    async getUserById(id: string): Promise<UserResponse> {
        try {
            const response = await client.get<UserResponse>(`/users/${id}`, authHeader);
            return response.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async getAllUsers(): Promise<UserLisResponse> {
        try {
            const response = await client.get<UserLisResponse>(`/users`, authHeader);
            return response.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async createUser(payload: CreateUserPayload): Promise<UserResponse> {
        try {
            const response = await client.post<UserResponse>(`/users`, payload, authHeader);
            return response.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async searchUsers(params: SearchUsersParams): Promise<UserLisResponse> {
        try {
            const response = await client.get<UserLisResponse>(`/users/search`, {
                headers: authHeader.headers,
                params: {
                    query: params.query,
                    ...(params.limit ? { limit: params.limit } : {}),
                    ...(params.exclude && params.exclude.length > 0 ? { exclude: params.exclude } : {}),
                },
            });

            return response.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },


}