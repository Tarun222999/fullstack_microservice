import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { HttpError } from '@chatapp/common';

const publisherMocks = vi.hoisted(() => ({
  publishingUserRegistered: vi.fn(),
}));

vi.mock('@/messaging/event-publishing', () => ({
  publishingUserRegistered: publisherMocks.publishingUserRegistered,
}));

describe('auth.service db integration', () => {
  let container: StartedTestContainer | null = null;
  let dbRuntimeAvailable = false;
  let sequelize: any;
  let UserCredentials: any;
  let RefreshToken: any;
  let registerFn: any;
  let loginFn: any;
  let refreshTokensFn: any;
  let revokeRefreshTokenFn: any;

  beforeAll(async () => {
    try {
      container = await new GenericContainer('mysql:8.0')
        .withEnvironment({
          MYSQL_DATABASE: 'auth_service_test',
          MYSQL_USER: 'auth_user',
          MYSQL_PASSWORD: 'auth_password',
          MYSQL_ROOT_PASSWORD: 'root_password',
        })
        .withCommand(['mysqld', '--default-authentication-plugin=mysql_native_password'])
        .withExposedPorts(3306)
        .withWaitStrategy(Wait.forLogMessage('ready for connections'))
        .start();

      const host = container.getHost();
      const port = container.getMappedPort(3306);
      process.env.AUTH_DB_URL = `mysql://auth_user:auth_password@${host}:${port}/auth_service_test`;

      const dbModule = await import('@/db/sequilize');
      const modelModule = await import('@/models');
      const serviceModule = await import('@/services/auth.service');

      sequelize = dbModule.sequelize;
      UserCredentials = modelModule.UserCredentials;
      RefreshToken = modelModule.RefreshToken;

      registerFn = serviceModule.register;
      loginFn = serviceModule.login;
      refreshTokensFn = serviceModule.refreshTokens;
      revokeRefreshTokenFn = serviceModule.revokeRefreshToken;

      let initialized = false;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          await sequelize.authenticate();
          await sequelize.sync({ force: true });
          initialized = true;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 2_000));
        }
      }

      if (!initialized) {
        throw lastError;
      }
      dbRuntimeAvailable = true;
    } catch (error) {
      dbRuntimeAvailable = false;
      const message = error instanceof Error ? error.message : 'Unknown container runtime error';
      console.warn(`[auth-service][db-test] Skipped: ${message}`);
    }
  });

  afterEach(async () => {
    if (!dbRuntimeAvailable) {
      return;
    }
    await RefreshToken.destroy({ where: {}, force: true });
    await UserCredentials.destroy({ where: {}, force: true });
    publisherMocks.publishingUserRegistered.mockReset();
  });

  afterAll(async () => {
    if (!dbRuntimeAvailable) {
      return;
    }
    if (sequelize) {
      await sequelize.close();
    }
    if (container) {
      await container.stop();
    }
  });

  it('register creates user and refresh-token rows', async (context) => {
    if (!dbRuntimeAvailable) {
      context.skip();
    }

    const result = await registerFn({
      email: 'register-db@example.com',
      password: 'Password123!',
      displayName: 'Register DB',
    });

    const user = await UserCredentials.findByPk(result.user.id);
    const refreshTokens = await RefreshToken.findAll({ where: { userId: result.user.id } });

    expect(user).not.toBeNull();
    expect(refreshTokens).toHaveLength(1);
    expect(result.accessToken).toBeTypeOf('string');
    expect(result.refreshToken).toBeTypeOf('string');
    expect(publisherMocks.publishingUserRegistered).toHaveBeenCalledTimes(1);
  });

  it('register with duplicate email returns 409', async (context) => {
    if (!dbRuntimeAvailable) {
      context.skip();
    }

    await registerFn({
      email: 'duplicate-db@example.com',
      password: 'Password123!',
      displayName: 'One',
    });

    await expect(
      registerFn({
        email: 'duplicate-db@example.com',
        password: 'Password123!',
        displayName: 'Two',
      }),
    ).rejects.toThrowError(HttpError);
  });

  it('login returns tokens and persists refresh token', async (context) => {
    if (!dbRuntimeAvailable) {
      context.skip();
    }

    await registerFn({
      email: 'login-db@example.com',
      password: 'Password123!',
      displayName: 'Login DB',
    });

    const result = await loginFn({
      email: 'login-db@example.com',
      password: 'Password123!',
    });

    const user = await UserCredentials.findOne({ where: { email: 'login-db@example.com' } });
    const refreshTokens = await RefreshToken.findAll({ where: { userId: user.id } });

    expect(result.accessToken).toBeTypeOf('string');
    expect(result.refreshToken).toBeTypeOf('string');
    expect(refreshTokens.length).toBeGreaterThanOrEqual(2);
  });

  it('login with invalid password returns 401', async (context) => {
    if (!dbRuntimeAvailable) {
      context.skip();
    }

    await registerFn({
      email: 'bad-login-db@example.com',
      password: 'Password123!',
      displayName: 'Bad Login',
    });

    await expect(
      loginFn({
        email: 'bad-login-db@example.com',
        password: 'WrongPassword999!',
      }),
    ).rejects.toThrowError(HttpError);
  });

  it('refreshTokens rotates token record', async (context) => {
    if (!dbRuntimeAvailable) {
      context.skip();
    }

    await registerFn({
      email: 'refresh-db@example.com',
      password: 'Password123!',
      displayName: 'Refresh DB',
    });

    const loginResult = await loginFn({
      email: 'refresh-db@example.com',
      password: 'Password123!',
    });

    const beforeRows = await RefreshToken.count();
    const refreshed = await refreshTokensFn(loginResult.refreshToken);
    const afterRows = await RefreshToken.count();

    expect(refreshed.accessToken).toBeTypeOf('string');
    expect(refreshed.refreshToken).toBeTypeOf('string');
    expect(afterRows).toBe(beforeRows);
    expect(refreshed.refreshToken).not.toBe(loginResult.refreshToken);
  });

  it('revokeRefreshToken removes all user refresh tokens', async (context) => {
    if (!dbRuntimeAvailable) {
      context.skip();
    }

    const registerResult = await registerFn({
      email: 'revoke-db@example.com',
      password: 'Password123!',
      displayName: 'Revoke DB',
    });

    await loginFn({
      email: 'revoke-db@example.com',
      password: 'Password123!',
    });

    const before = await RefreshToken.count({ where: { userId: registerResult.user.id } });
    await revokeRefreshTokenFn(registerResult.user.id);
    const after = await RefreshToken.count({ where: { userId: registerResult.user.id } });

    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
  });
});
