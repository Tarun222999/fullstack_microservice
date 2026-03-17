import jwt from 'jsonwebtoken';
import { HttpError, type AuthenticatedUser } from '@chatapp/common';
import type { Socket } from 'socket.io';

import { env } from '@/config/env';

interface AccessTokenClaims {
    sub: string;
    email?: string;
}

const parseAuthorizationHeader = (value: string | undefined): string => {
    if (!value) {
        throw new HttpError(401, 'Unauthorized');
    }

    const [scheme, token] = value.split(' ');

    if (scheme.toLowerCase() !== 'bearer' || !token) {
        throw new HttpError(401, 'Unauthorized');
    }

    return token;
};

const toAuthenticatedUser = (claims: AccessTokenClaims): AuthenticatedUser => {
    if (!claims.sub) {
        throw new HttpError(401, 'Unauthorized');
    }

    return {
        id: claims.sub,
        email: claims.email,
    };
};

const getAuthToken = (socket: Socket): string => {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
        return authToken;
    }

    const authorization = socket.handshake.headers.authorization;
    if (typeof authorization === 'string') {
        return parseAuthorizationHeader(authorization);
    }

    throw new HttpError(401, 'Unauthorized');
};

export const authenticateSocket = (socket: Socket): AuthenticatedUser => {
    try {
        const token = getAuthToken(socket);
        const claims = jwt.verify(token, env.JWT_SECRET) as AccessTokenClaims;
        return toAuthenticatedUser(claims);
    } catch (error) {
        if (error instanceof HttpError) {
            throw error;
        }

        throw new HttpError(401, 'Unauthorized');
    }
};
