import { HttpError } from "@chatapp/common";
import axios from "axios"
import { env } from "@/config/env";

const client = axios.create({
    baseURL: env.AUTH_SERVICE_URL,
    timeout: 5000
})


const authHeader = {
    headers: {
        'X-internal-token': env.INTERNAL_API_TOKEN
    }
} as const


export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface UserData {
    id: string;
    email: string;
    displayName: string;
    createdAt: string;
}


export interface AuthResponse extends AuthTokens {
    user: UserData;
}

export interface RegisterPayload {
    email: string;
    password: string;
    displayName: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface RefreshPayload {
    refreshToken: string;
}


export interface RevokePayload {
    userId: string;
}


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
}

const handleAxiosError = (error: unknown): never => {
    if (!axios.isAxiosError(error) || !error.response) {
        throw new HttpError(500, 'Authentications service is unavailable')
    }
    const { status, data } = error.response as { status: number; data: unknown };

    throw new HttpError(status, resolvedMessage(status, data));
}


export const authProxyService = {
    async register(payload: RegisterPayload): Promise<AuthResponse> {
        try {
            const response = await client.post<AuthResponse>('/auth/register', payload, authHeader)

            return response.data
        } catch (error) {
            return handleAxiosError(error)
        }
    },
    async login(payload: LoginPayload): Promise<AuthTokens> {
        try {
            const response = await client.post<AuthTokens>('/auth/login', payload, authHeader);
            return response.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async refresh(payload: RefreshPayload): Promise<AuthTokens> {
        try {
            const response = await client.post<AuthTokens>('/auth/refresh', payload, authHeader);
            return response.data;
        } catch (error) {
            return handleAxiosError(error);
        }
    },

    async revoke(payload: RevokePayload): Promise<void> {
        try {
            await client.post<void>('/auth/revoke', payload, authHeader);
        } catch (error) {
            return handleAxiosError(error);
        }
    },

}

