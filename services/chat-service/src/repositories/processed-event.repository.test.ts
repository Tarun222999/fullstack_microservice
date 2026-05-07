import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMocks = vi.hoisted(() => ({
  CONSUMER_DEDUPE_ENABLED: true,
  CONSUMER_LOCK_TIMEOUT_MS: 30_000,
}));

const collectionMocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  insertOne: vi.fn(),
  findOne: vi.fn(),
  updateOne: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  env: envMocks,
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

vi.mock('@/clients/mongo.client', () => ({
  getMongoClient: vi.fn().mockResolvedValue({
    db: () => ({
      collection: () => collectionMocks,
    }),
  }),
}));

import {
  beginProcessingEvent,
  ensureProcessedEventIndexes,
  markFailedEvent,
  markProcessedEvent,
} from '@/repositories/processed-event.repository';

describe('processed-event.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMocks.CONSUMER_DEDUPE_ENABLED = true;
  });

  it('creates indexes', async () => {
    collectionMocks.createIndex.mockResolvedValue('status_1_lockedAt_1');

    await ensureProcessedEventIndexes();

    expect(collectionMocks.createIndex).toHaveBeenNthCalledWith(1, { status: 1, lockedAt: 1 });
    expect(collectionMocks.createIndex).toHaveBeenNthCalledWith(2, { eventType: 1 });
    expect(collectionMocks.createIndex).toHaveBeenNthCalledWith(
      3,
      { processedAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30 },
    );
  });

  it('returns acquired on first insert', async () => {
    collectionMocks.insertOne.mockResolvedValue({ acknowledged: true });

    const result = await beginProcessingEvent('evt-1', 'user.created', 'chat-service.user');

    expect(result).toBe('acquired');
  });

  it('returns duplicate when existing row is processed', async () => {
    const error: any = new Error('dup');
    error.code = 11000;
    collectionMocks.insertOne.mockRejectedValue(error);
    collectionMocks.findOne.mockResolvedValue({ status: 'processed' });

    const result = await beginProcessingEvent('evt-1', 'user.created', 'chat-service.user');

    expect(result).toBe('duplicate');
  });

  it('returns acquired when dedupe is disabled', async () => {
    envMocks.CONSUMER_DEDUPE_ENABLED = false;

    const result = await beginProcessingEvent('evt-1', 'user.created', 'chat-service.user');

    expect(result).toBe('acquired');
    expect(collectionMocks.insertOne).not.toHaveBeenCalled();
  });

  it('returns in_progress for recent processing lock', async () => {
    const error: any = new Error('dup');
    error.code = 11000;
    collectionMocks.insertOne.mockRejectedValue(error);
    collectionMocks.findOne.mockResolvedValue({ status: 'processing', lockedAt: new Date() });
    collectionMocks.updateOne.mockResolvedValue({ modifiedCount: 0 });

    const result = await beginProcessingEvent('evt-1', 'user.created', 'chat-service.user');

    expect(result).toBe('in_progress');
  });

  it('reclaims stale processing locks', async () => {
    const error: any = new Error('dup');
    error.code = 11000;
    collectionMocks.insertOne.mockRejectedValue(error);
    collectionMocks.findOne.mockResolvedValue({
      status: 'processing',
      lockedAt: new Date(Date.now() - 120_000),
    });
    collectionMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await beginProcessingEvent('evt-1', 'user.created', 'chat-service.user');

    expect(result).toBe('acquired');
  });

  it('marks processed', async () => {
    collectionMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await markProcessedEvent('evt-2');

    expect(collectionMocks.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMocks.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-2' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'processed',
        }),
      }),
    );
  });

  it('marks failed', async () => {
    collectionMocks.updateOne.mockResolvedValue({ modifiedCount: 1 });

    await markFailedEvent('evt-2', new Error('boom'));

    expect(collectionMocks.updateOne).toHaveBeenCalledTimes(1);
    expect(collectionMocks.updateOne).toHaveBeenCalledWith(
      { _id: 'evt-2' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'failed',
          lastError: 'boom',
        }),
      }),
    );
  });
});
