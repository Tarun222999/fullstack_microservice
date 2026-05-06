import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const authServiceMocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refreshTokens: vi.fn(),
  revokeRefreshToken: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/services/auth.service', () => ({
  register: authServiceMocks.register,
  login: authServiceMocks.login,
  refreshTokens: authServiceMocks.refreshTokens,
  revokeRefreshToken: authServiceMocks.revokeRefreshToken,
}));

vi.mock('@/utils/logger', () => ({
  logger: loggerMocks,
}));

import { createApp } from '@/app';

const internalHeaders = {
  'x-internal-token': process.env.INTERNAL_API_TOKEN as string,
};

describe('auth-service http', () => {
  it('GET /health returns service status without internal token', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('POST /auth/login returns 401 when internal token is missing', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/login').send({
      email: 'valid@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('POST /auth/register returns 422 for invalid payload', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/register').set(internalHeaders).send({
      email: 'bad',
      password: '123',
      displayName: 'x',
    });

    expect(response.status).toBe(422);
    expect(response.body.message).toBe('Validation Error');
  });

  it('POST /auth/register returns created tokens for valid payload', async () => {
    authServiceMocks.register.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'bd6d9362-2f0a-406f-b734-e785d8ad53eb',
        email: 'valid@example.com',
        displayName: 'Valid User',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    });
    const app = createApp();

    const response = await request(app).post('/auth/register').set(internalHeaders).send({
      email: 'valid@example.com',
      password: 'Password123!',
      displayName: 'Valid User',
    });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBe('access-token');
    expect(authServiceMocks.register).toHaveBeenCalledWith({
      email: 'valid@example.com',
      password: 'Password123!',
      displayName: 'Valid User',
    });
  });

  it('POST /auth/login returns tokens for valid payload', async () => {
    authServiceMocks.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const app = createApp();

    const response = await request(app).post('/auth/login').set(internalHeaders).send({
      email: 'valid@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('POST /auth/refresh delegates to service and returns tokens', async () => {
    authServiceMocks.refreshTokens.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    const app = createApp();

    const response = await request(app).post('/auth/refresh').set(internalHeaders).send({
      refreshToken: 'old-refresh-token',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(authServiceMocks.refreshTokens).toHaveBeenCalledWith('old-refresh-token');
  });

  it('POST /auth/revoke returns 204 and delegates', async () => {
    authServiceMocks.revokeRefreshToken.mockResolvedValue(undefined);
    const app = createApp();

    const response = await request(app).post('/auth/revoke').set(internalHeaders).send({
      userId: 'bd6d9362-2f0a-406f-b734-e785d8ad53eb',
    });

    expect(response.status).toBe(204);
    expect(authServiceMocks.revokeRefreshToken).toHaveBeenCalledWith(
      'bd6d9362-2f0a-406f-b734-e785d8ad53eb',
    );
  });
});
