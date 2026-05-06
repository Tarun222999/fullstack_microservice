import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@chatapp/common';

const sequelizeMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

const transactionMocks = vi.hoisted(() => ({
  commit: vi.fn(),
  rollback: vi.fn(),
}));

const modelMocks = vi.hoisted(() => ({
  UserCredentials: {
    findOne: vi.fn(),
    create: vi.fn(),
    findByPk: vi.fn(),
  },
  RefreshToken: {
    findOne: vi.fn(),
    create: vi.fn(),
    destroy: vi.fn(),
  },
  enqueueOutboxEvent: vi.fn(),
}));

const tokenMocks = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyPassword: vi.fn(),
  verifyRefreshToken: vi.fn(),
}));

const publisherMocks = vi.hoisted(() => ({
  publishingUserRegistered: vi.fn(),
}));

const envMocks = vi.hoisted(() => ({
  OUTBOX_ENABLED: false,
}));

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock('@/db/sequilize', () => ({
  sequelize: sequelizeMocks,
}));

vi.mock('@/models', () => ({
  UserCredentials: modelMocks.UserCredentials,
  RefreshToken: modelMocks.RefreshToken,
  enqueueOutboxEvent: modelMocks.enqueueOutboxEvent,
}));

vi.mock('@/utils/token', () => ({
  hashPassword: tokenMocks.hashPassword,
  signAccessToken: tokenMocks.signAccessToken,
  signRefreshToken: tokenMocks.signRefreshToken,
  verifyPassword: tokenMocks.verifyPassword,
  verifyRefreshToken: tokenMocks.verifyRefreshToken,
}));

vi.mock('@/messaging/event-publishing', () => ({
  publishingUserRegistered: publisherMocks.publishingUserRegistered,
}));

vi.mock('@/config/env', () => ({
  env: envMocks,
}));

vi.mock('@/utils/logger', () => ({
  logger: loggerMocks,
}));

import { login, refreshTokens, register, revokeRefreshToken } from '@/services/auth.service';

describe('auth.service', () => {
  beforeEach(() => {
    envMocks.OUTBOX_ENABLED = false;
    vi.clearAllMocks();
  });

  it('register enqueues outbox event when outbox is enabled', async () => {
    envMocks.OUTBOX_ENABLED = true;
    sequelizeMocks.transaction.mockResolvedValue(transactionMocks);
    modelMocks.UserCredentials.findOne.mockResolvedValue(null);
    tokenMocks.hashPassword.mockResolvedValue('hashed-password');
    modelMocks.UserCredentials.create.mockResolvedValue({
      id: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      email: 'new@example.com',
      displayName: 'New User',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    modelMocks.RefreshToken.create.mockResolvedValue({
      id: 'c8ea7e24-8a58-40e1-ac40-f5bb42d0cae9',
      tokenId: 'c8ea7e24-8a58-40e1-ac40-f5bb42d0cae9',
      userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    tokenMocks.signAccessToken.mockReturnValue('access-token');
    tokenMocks.signRefreshToken.mockReturnValue('refresh-token');

    await register({
      email: 'new@example.com',
      password: 'Password123!',
      displayName: 'New User',
    });

    expect(modelMocks.enqueueOutboxEvent).toHaveBeenCalledTimes(1);
    expect(modelMocks.enqueueOutboxEvent.mock.calls[0][1]).toBe(transactionMocks);
    expect(publisherMocks.publishingUserRegistered).not.toHaveBeenCalled();
    envMocks.OUTBOX_ENABLED = false;
  });

  it('registers user, commits transaction, and publishes event', async () => {
    envMocks.OUTBOX_ENABLED = false;
    sequelizeMocks.transaction.mockResolvedValue(transactionMocks);
    modelMocks.UserCredentials.findOne.mockResolvedValue(null);
    tokenMocks.hashPassword.mockResolvedValue('hashed-password');
    modelMocks.UserCredentials.create.mockResolvedValue({
      id: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      email: 'new@example.com',
      displayName: 'New User',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    modelMocks.RefreshToken.create.mockResolvedValue({
      id: 'c8ea7e24-8a58-40e1-ac40-f5bb42d0cae9',
      tokenId: 'c8ea7e24-8a58-40e1-ac40-f5bb42d0cae9',
      userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    tokenMocks.signAccessToken.mockReturnValue('access-token');
    tokenMocks.signRefreshToken.mockReturnValue('refresh-token');

    const result = await register({
      email: 'new@example.com',
      password: 'Password123!',
      displayName: 'New User',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.id).toBe('a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14');
    expect(transactionMocks.commit).toHaveBeenCalledTimes(1);
    expect(transactionMocks.rollback).not.toHaveBeenCalled();
    expect(publisherMocks.publishingUserRegistered).toHaveBeenCalledTimes(1);
  });

  it('throws 409 when registering existing email', async () => {
    modelMocks.UserCredentials.findOne.mockResolvedValue({
      id: 'existing-user',
    });

    await expect(
      register({
        email: 'existing@example.com',
        password: 'Password123!',
        displayName: 'Existing',
      }),
    ).rejects.toThrowError(HttpError);
  });

  it('rolls back transaction when register create step fails', async () => {
    sequelizeMocks.transaction.mockResolvedValue(transactionMocks);
    modelMocks.UserCredentials.findOne.mockResolvedValue(null);
    tokenMocks.hashPassword.mockResolvedValue('hashed-password');
    modelMocks.UserCredentials.create.mockRejectedValue(new Error('insert failed'));

    await expect(
      register({
        email: 'broken@example.com',
        password: 'Password123!',
        displayName: 'Broken',
      }),
    ).rejects.toThrow('insert failed');

    expect(transactionMocks.rollback).toHaveBeenCalledTimes(1);
  });

  it('logs in successfully with valid credentials', async () => {
    modelMocks.UserCredentials.findOne.mockResolvedValue({
      id: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      email: 'valid@example.com',
      passwordHash: 'hash',
    });
    tokenMocks.verifyPassword.mockResolvedValue(true);
    modelMocks.RefreshToken.create.mockResolvedValue({
      id: 'e2dd1ac8-44d8-4272-b6a0-19eecabdb0b3',
      tokenId: 'token-1',
      userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      expiresAt: new Date('2026-02-01T00:00:00.000Z'),
    });
    tokenMocks.signAccessToken.mockReturnValue('access-login');
    tokenMocks.signRefreshToken.mockReturnValue('refresh-login');

    const result = await login({
      email: 'valid@example.com',
      password: 'Password123!',
    });

    expect(result).toEqual({
      accessToken: 'access-login',
      refreshToken: 'refresh-login',
    });
  });

  it('rejects login when user is missing', async () => {
    modelMocks.UserCredentials.findOne.mockResolvedValue(null);

    await expect(
      login({
        email: 'none@example.com',
        password: 'Password123!',
      }),
    ).rejects.toThrowError(HttpError);
  });

  it('rejects login when password is invalid', async () => {
    modelMocks.UserCredentials.findOne.mockResolvedValue({
      id: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      email: 'valid@example.com',
      passwordHash: 'hash',
    });
    tokenMocks.verifyPassword.mockResolvedValue(false);

    await expect(
      login({
        email: 'valid@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrowError(HttpError);
  });

  it('refreshes tokens successfully when refresh token record and user exist', async () => {
    tokenMocks.verifyRefreshToken.mockReturnValue({
      sub: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      tokenId: 'token-1',
    });
    const destroy = vi.fn().mockResolvedValue(undefined);
    modelMocks.RefreshToken.findOne.mockResolvedValue({
      tokenId: 'token-1',
      userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      expiresAt: new Date(Date.now() + 60_000),
      destroy,
    });
    modelMocks.UserCredentials.findByPk.mockResolvedValue({
      id: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      email: 'valid@example.com',
    });
    modelMocks.RefreshToken.create.mockResolvedValue({
      id: 'new-record-id',
      tokenId: 'token-2',
      userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    tokenMocks.signAccessToken.mockReturnValue('access-refreshed');
    tokenMocks.signRefreshToken.mockReturnValue('refresh-refreshed');

    const result = await refreshTokens('refresh-token-value');

    expect(result).toEqual({
      accessToken: 'access-refreshed',
      refreshToken: 'refresh-refreshed',
    });
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects refresh when token record is missing', async () => {
    tokenMocks.verifyRefreshToken.mockReturnValue({
      sub: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      tokenId: 'missing-token',
    });
    modelMocks.RefreshToken.findOne.mockResolvedValue(null);

    await expect(refreshTokens('refresh-token-value')).rejects.toThrowError(HttpError);
  });

  it('destroys and rejects expired refresh token', async () => {
    tokenMocks.verifyRefreshToken.mockReturnValue({
      sub: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      tokenId: 'expired-token',
    });
    const destroy = vi.fn().mockResolvedValue(undefined);
    modelMocks.RefreshToken.findOne.mockResolvedValue({
      tokenId: 'expired-token',
      userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14',
      expiresAt: new Date(Date.now() - 60_000),
      destroy,
    });

    await expect(refreshTokens('refresh-token-value')).rejects.toThrowError(HttpError);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('revokes refresh tokens by user id', async () => {
    modelMocks.RefreshToken.destroy.mockResolvedValue(1);

    await revokeRefreshToken('a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14');

    expect(modelMocks.RefreshToken.destroy).toHaveBeenCalledWith({
      where: { userId: 'a1f9e448-cc0c-4adf-b8b8-f27d16b8ca14' },
    });
  });
});
