import jwt from 'jsonwebtoken';
import { HttpError, type AuthenticatedUser, z } from '@chatapp/common';
import type { Socket } from 'socket.io';

import { env } from '@/config/env';

const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
});

type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

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
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const claims = accessTokenClaimsSchema.parse(decoded);
    return toAuthenticatedUser(claims);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, 'Unauthorized');
  }
};
