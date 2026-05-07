import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@chatapp/common';
import { UniqueConstraintError } from 'sequelize';

const repositoryMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  findAllExcept: vi.fn(),
  findByIds: vi.fn(),
  create: vi.fn(),
  searchByQuery: vi.fn(),
  upsertFromAuthEvent: vi.fn(),
}));

const publisherMocks = vi.hoisted(() => ({
  publishUserCreatedEvent: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  enqueueOutboxEvent: vi.fn(),
  sequelize: {
    transaction: vi.fn(),
  },
}));

const envMocks = vi.hoisted(() => ({
  OUTBOX_ENABLED: false,
}));

vi.mock('@/repository/user.repositories', () => ({
  UserRepository: vi.fn(),
  userRepository: repositoryMocks,
}));

vi.mock('@/config/env', () => ({
  env: envMocks,
}));

vi.mock('@/db', () => ({
  enqueueOutboxEvent: dbMocks.enqueueOutboxEvent,
  sequelize: dbMocks.sequelize,
}));

vi.mock('@/messaging/event-publisher', () => ({
  publishUserCreatedEvent: publisherMocks.publishUserCreatedEvent,
}));

import { userService } from '@/services/user.service';

describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMocks.OUTBOX_ENABLED = false;
    (dbMocks.sequelize.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: any) => cb({}),
    );
  });

  it('returns user by id when found', async () => {
    const user = {
      id: '1e5c2af9-80c1-4d0b-bf56-c9b8ef49537d',
      email: 'a@example.com',
      displayName: 'Alpha',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repositoryMocks.findById.mockResolvedValue(user);

    const result = await userService.getUserById(user.id);

    expect(result).toEqual(user);
    expect(repositoryMocks.findById).toHaveBeenCalledWith(user.id);
  });

  it('throws 404 when user is not found', async () => {
    repositoryMocks.findById.mockResolvedValue(null);

    await expect(
      userService.getUserById('f2271d11-46f1-490b-b137-1f5bfbf0ee7c'),
    ).rejects.toThrowError(HttpError);
  });

  it('creates user and publishes user.created event', async () => {
    const createdUser = {
      id: 'f2271d11-46f1-490b-b137-1f5bfbf0ee7c',
      email: 'new@example.com',
      displayName: 'New User',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repositoryMocks.create.mockResolvedValue(createdUser);
    publisherMocks.publishUserCreatedEvent.mockResolvedValue(undefined);

    const result = await userService.createUser({
      email: 'new@example.com',
      displayName: 'New User',
    });

    expect(result).toEqual(createdUser);
    expect(repositoryMocks.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      displayName: 'New User',
    });
    expect(publisherMocks.publishUserCreatedEvent).toHaveBeenCalledWith({
      id: createdUser.id,
      email: createdUser.email,
      displayName: createdUser.displayName,
      createdAt: createdUser.createdAt.toISOString(),
      updatedAt: createdUser.updatedAt.toISOString(),
    });
  });

  it('maps unique constraint error to 409', async () => {
    repositoryMocks.create.mockRejectedValue(
      new UniqueConstraintError({ message: 'duplicate', errors: [] }),
    );

    await expect(
      userService.createUser({
        email: 'duplicate@example.com',
        displayName: 'Dup',
      }),
    ).rejects.toThrowError(HttpError);
  });

  it('returns empty array when search query is blank', async () => {
    const result = await userService.searchUsers({
      query: '   ',
      limit: 10,
      excludeIds: [],
    });

    expect(result).toEqual([]);
    expect(repositoryMocks.searchByQuery).not.toHaveBeenCalled();
  });

  it('trims search query and delegates to repository', async () => {
    const users = [
      {
        id: '4b41d2de-6fd0-4d62-a17c-d43765434a74',
        email: 'alpha@example.com',
        displayName: 'Alpha',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    repositoryMocks.searchByQuery.mockResolvedValue(users);

    const result = await userService.searchUsers({
      query: ' alpha ',
      limit: 5,
      excludeIds: ['deadbeef-0000-0000-0000-000000000001'],
    });

    expect(result).toEqual(users);
    expect(repositoryMocks.searchByQuery).toHaveBeenCalledWith('alpha', {
      limit: 5,
      excludeIds: ['deadbeef-0000-0000-0000-000000000001'],
    });
  });

  it('returns DM candidates excluding the current user', async () => {
    const users = [
      {
        id: '4b41d2de-6fd0-4d62-a17c-d43765434a74',
        displayName: 'Alpha',
      },
    ];
    repositoryMocks.findAllExcept.mockResolvedValue(users);

    const result = await userService.getDmCandidates('deadbeef-0000-0000-0000-000000000001');

    expect(result).toEqual(users);
    expect(repositoryMocks.findAllExcept).toHaveBeenCalledWith(
      'deadbeef-0000-0000-0000-000000000001',
    );
  });

  it('returns users by ids for hydration', async () => {
    const users = [
      {
        id: '4b41d2de-6fd0-4d62-a17c-d43765434a74',
        displayName: 'Alpha',
      },
      {
        id: '5c2f1d8a-5d27-4ca3-a7af-3a9c2c2c2c2c',
        displayName: 'Beta',
      },
    ];
    repositoryMocks.findByIds.mockResolvedValue(users);

    const result = await userService.getUsersByIds({
      ids: ['5c2f1d8a-5d27-4ca3-a7af-3a9c2c2c2c2c', '4b41d2de-6fd0-4d62-a17c-d43765434a74'],
    });

    expect(result).toEqual(users);
    expect(repositoryMocks.findByIds).toHaveBeenCalledWith([
      '5c2f1d8a-5d27-4ca3-a7af-3a9c2c2c2c2c',
      '4b41d2de-6fd0-4d62-a17c-d43765434a74',
    ]);
  });

  it('syncs auth user and republishes event payload', async () => {
    const syncedUser = {
      id: '7f17f8cb-68c7-4f94-8d84-e1e686cf2f63',
      email: 'synced@example.com',
      displayName: 'Synced',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repositoryMocks.upsertFromAuthEvent.mockResolvedValue(syncedUser);
    publisherMocks.publishUserCreatedEvent.mockResolvedValue(undefined);

    const payload = {
      id: syncedUser.id,
      email: syncedUser.email,
      displayName: syncedUser.displayName,
      createdAt: syncedUser.createdAt.toISOString(),
    };

    const result = await userService.syncFromAuthUser(payload);

    expect(result).toEqual(syncedUser);
    expect(repositoryMocks.upsertFromAuthEvent).toHaveBeenCalledWith(payload);
    expect(publisherMocks.publishUserCreatedEvent).toHaveBeenCalledTimes(1);
  });

  it('createUser enqueues outbox event when outbox is enabled', async () => {
    envMocks.OUTBOX_ENABLED = true;
    const createdUser = {
      id: 'f2271d11-46f1-490b-b137-1f5bfbf0ee7c',
      email: 'new@example.com',
      displayName: 'New User',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repositoryMocks.create.mockResolvedValue(createdUser);

    await userService.createUser({
      email: 'new@example.com',
      displayName: 'New User',
    });

    expect(dbMocks.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.enqueueOutboxEvent).toHaveBeenCalledTimes(1);
    expect(publisherMocks.publishUserCreatedEvent).not.toHaveBeenCalled();
  });

  it('syncFromAuthUser enqueues outbox event when outbox is enabled', async () => {
    envMocks.OUTBOX_ENABLED = true;
    const syncedUser = {
      id: '7f17f8cb-68c7-4f94-8d84-e1e686cf2f63',
      email: 'synced@example.com',
      displayName: 'Synced',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    repositoryMocks.upsertFromAuthEvent.mockResolvedValue(syncedUser);

    await userService.syncFromAuthUser({
      id: syncedUser.id,
      email: syncedUser.email,
      displayName: syncedUser.displayName,
      createdAt: syncedUser.createdAt.toISOString(),
    });

    expect(dbMocks.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(dbMocks.enqueueOutboxEvent).toHaveBeenCalledTimes(1);
    expect(publisherMocks.publishUserCreatedEvent).not.toHaveBeenCalled();
  });
});
