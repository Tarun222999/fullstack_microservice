import { beforeEach, describe, expect, it, vi } from 'vitest';

const envMocks = vi.hoisted(() => ({
  CONSUMER_DEDUPE_ENABLED: true,
  CONSUMER_LOCK_TIMEOUT_MS: 30_000,
}));

const modelMocks = vi.hoisted(() => ({
  create: vi.fn(),
  findByPk: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/config/env', () => ({
  env: envMocks,
}));

vi.mock('@/db', () => ({
  ProcessedEventModel: modelMocks,
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}));

import {
  beginProcessingEvent,
  markFailedEvent,
  markProcessedEvent,
} from '@/messaging/consumer-idempotency';

describe('consumer-idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMocks.CONSUMER_DEDUPE_ENABLED = true;
  });

  it('returns acquired when first insert succeeds', async () => {
    modelMocks.create.mockResolvedValue({});

    const result = await beginProcessingEvent('evt-1', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('acquired');
    expect(modelMocks.create).toHaveBeenCalledTimes(1);
  });

  it('returns acquired without hitting DB when dedupe is disabled', async () => {
    envMocks.CONSUMER_DEDUPE_ENABLED = false;

    const result = await beginProcessingEvent('evt-1', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('acquired');
    expect(modelMocks.create).not.toHaveBeenCalled();
    expect(modelMocks.findByPk).not.toHaveBeenCalled();
    expect(modelMocks.update).not.toHaveBeenCalled();
  });

  it('returns duplicate when existing row is already processed', async () => {
    modelMocks.create.mockRejectedValue({ original: { code: '23505' } });
    modelMocks.findByPk.mockResolvedValue({ status: 'processed' });

    const result = await beginProcessingEvent('evt-1', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('duplicate');
  });

  it('reclaims stale processing rows', async () => {
    modelMocks.create.mockRejectedValue({ original: { code: '23505' } });
    modelMocks.findByPk.mockResolvedValue({
      status: 'processing',
      lockedAt: new Date(Date.now() - 60_000),
    });
    modelMocks.update.mockResolvedValue([1]);

    const result = await beginProcessingEvent('evt-2', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('acquired');
    expect(modelMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
      }),
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: 'evt-2',
          status: 'processing',
        }),
      }),
    );
  });

  it('returns acquired for failed records when update succeeds', async () => {
    modelMocks.create.mockRejectedValue({ original: { code: '23505' } });
    modelMocks.findByPk.mockResolvedValue({ status: 'failed' });
    modelMocks.update.mockResolvedValue([1]);

    const result = await beginProcessingEvent('evt-4', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('acquired');
  });

  it('returns in_progress when duplicate occurs and row is missing', async () => {
    modelMocks.create.mockRejectedValue({ original: { code: '23505' } });
    modelMocks.findByPk.mockResolvedValue(null);

    const result = await beginProcessingEvent('evt-5', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('in_progress');
  });

  it('returns in_progress when stale reclaim update does not win', async () => {
    modelMocks.create.mockRejectedValue({ original: { code: '23505' } });
    modelMocks.findByPk.mockResolvedValue({
      status: 'processing',
      lockedAt: new Date(Date.now() - 60_000),
    });
    modelMocks.update.mockResolvedValue([0]);

    const result = await beginProcessingEvent('evt-6', 'auth.user.registered', 'user-service.auth');

    expect(result).toBe('in_progress');
  });

  it('marks processed and failed states', async () => {
    await markProcessedEvent('evt-3');
    await markFailedEvent('evt-3', new Error('boom'));

    expect(modelMocks.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: 'processed' }),
      { where: { eventId: 'evt-3' } },
    );
    expect(modelMocks.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ status: 'failed', lastError: 'boom' }),
      { where: { eventId: 'evt-3' } },
    );
  });
});
