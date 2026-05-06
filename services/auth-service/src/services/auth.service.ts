import { sequelize } from '@/db/sequilize';
import { env } from '@/config/env';
import { publishingUserRegistered } from '@/messaging/event-publishing';
import { enqueueOutboxEvent, RefreshToken, UserCredentials } from '@/models';
import { AuthResponse, AuthTokens, LoginInput, RegisterInput } from '@/types/auth';
import { logger } from '@/utils/logger';
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '@/utils/token';
import { HttpError } from '@chatapp/common';
import { Op, Transaction } from 'sequelize';
import { AUTH_EVENT_EXCHANGE, AUTH_USER_REGISTERED_ROUTING_KEY } from '@chatapp/common';

const REFRESH_TOKEN_TTL_DAYS = 30;
export const register = async (input: RegisterInput): Promise<AuthResponse> => {
  const existing = await UserCredentials.findOne({
    where: { email: { [Op.eq]: input.email } },
  });

  if (existing) {
    throw new HttpError(409, 'User with this email already exists');
  }

  const transaction = await sequelize.transaction();

  try {
    const passwordHash = await hashPassword(input.password);
    const user = await UserCredentials.create(
      {
        email: input.email,
        displayName: input.displayName,
        passwordHash,
      },
      { transaction },
    );
    const refreshTokenRecord = await createRefreshToken(user.id, transaction);

    const userData = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
    };
    if (env.OUTBOX_ENABLED) {
      const eventId = crypto.randomUUID();

      await enqueueOutboxEvent(
        {
          eventType: AUTH_USER_REGISTERED_ROUTING_KEY,
          exchangeName: AUTH_EVENT_EXCHANGE,
          routingKey: AUTH_USER_REGISTERED_ROUTING_KEY,
          payload: {
            eventId,
            type: AUTH_USER_REGISTERED_ROUTING_KEY,
            payload: userData,
            occuredAt: new Date().toISOString(),
            metadata: { version: 1, eventId },
          },
          metadata: {
            eventId,
            aggregateType: 'user',
            aggregateId: user.id,
          },
        },
        transaction,
      );
    }

    await transaction.commit();

    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({
      sub: user.id,
      tokenId: refreshTokenRecord.id,
    });

    if (!env.OUTBOX_ENABLED) {
      publishingUserRegistered(userData);
    }
    return {
      accessToken,
      refreshToken,
      user: userData,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const login = async (input: LoginInput): Promise<AuthTokens> => {
  const credentials = await UserCredentials.findOne({ where: { email: { [Op.eq]: input.email } } });

  if (!credentials) {
    throw new HttpError(401, 'Invalid Credentials');
  }

  const valid = await verifyPassword(input.password, credentials.passwordHash);

  if (!valid) {
    throw new HttpError(401, 'Invalid Credentials');
  }

  const refreshTokenRecord = await createRefreshToken(credentials.id);

  const accessToken = signAccessToken({ sub: credentials.id, email: credentials.email });

  const refreshToken = signRefreshToken({
    sub: credentials.id,
    tokenId: refreshTokenRecord.tokenId,
  });

  return {
    accessToken,
    refreshToken,
  };
};
export const refreshTokens = async (token: string): Promise<AuthTokens> => {
  const payload = verifyRefreshToken(token);

  const tokenRecord = await RefreshToken.findOne({
    where: { tokenId: payload.tokenId, userId: payload.sub },
  });

  if (!tokenRecord) {
    throw new HttpError(401, 'Invalid Refresh Token');
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    await tokenRecord.destroy();
    throw new HttpError(401, 'Refresh token has expried');
  }

  const credentails = await UserCredentials.findByPk(payload.sub);

  if (!credentails) {
    logger.warn({ userId: payload.sub }, 'User missing for refresh token');
    throw new HttpError(401, 'Invalid refresh token');
  }

  await tokenRecord.destroy();
  const newTokenRecord = await createRefreshToken(credentails.id);

  return {
    accessToken: signAccessToken({ sub: credentails.id, email: credentails.email }),
    refreshToken: signRefreshToken({ sub: credentails.id, tokenId: newTokenRecord.tokenId }),
  };
};

export const revokeRefreshToken = async (userId: string) => {
  await RefreshToken.destroy({ where: { userId } });
};

const createRefreshToken = async (userId: string, transaction?: Transaction) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);

  const tokenId = crypto.randomUUID();

  const record = await RefreshToken.create(
    {
      userId,
      tokenId,
      expiresAt,
    },
    { transaction },
  );

  return record;
};
