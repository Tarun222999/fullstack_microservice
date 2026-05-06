import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { getChatDbRuntime } from '@/test/db-runtime';

describe('conversationService db integration', () => {
  let runtime: Awaited<ReturnType<typeof getChatDbRuntime>>;

  beforeAll(async () => {
    runtime = await getChatDbRuntime();
  });

  afterEach(async () => {
    if (!runtime.available) {
      return;
    }
    await runtime.reset?.();
  });

  afterAll(async () => {
    if (!runtime.available) {
      return;
    }
    await runtime.cleanup?.();
  });

  it('getConversationById follows read-through cache behavior', async (context) => {
    if (!runtime.available) {
      context.skip();
    }

    const created = await runtime.conversationRepository.create({
      title: 'Cache Chat',
      participantIds: [
        'ea43bfde-4aab-4215-990a-927da133b6ce',
        '112f8d72-4ed6-4bf1-be77-85db63e03a39',
      ],
    });

    const first = await runtime.conversationService.getConversationById(created.id);
    expect(first.id).toBe(created.id);
    expect(first.kind).toBe('group');

    const mongo = await runtime.getMongoClient();
    await mongo.db().collection('conversations').deleteOne({ _id: created.id });

    const second = await runtime.conversationService.getConversationById(created.id);
    expect(second.id).toBe(created.id);
  });

  it('touchConversation updates preview and invalidates cache', async (context) => {
    if (!runtime.available) {
      context.skip();
    }

    const created = await runtime.conversationService.createConversation({
      title: 'Touch Chat',
      participantIds: [
        'ea43bfde-4aab-4215-990a-927da133b6ce',
        '112f8d72-4ed6-4bf1-be77-85db63e03a39',
      ],
    });

    await runtime.conversationService.getConversationById(created.id);
    await runtime.conversationService.touchConversation(created.id, 'Latest preview text');

    const redis = runtime.getRedisClient();
    const cached = await redis.get(`conversation:${created.id}`);
    expect(cached).toBeNull();

    const updated = await runtime.conversationRepository.findById(created.id);
    expect(updated.lastMessagePreview).toBe('Latest preview text');
    expect(updated.lastMessageAt).not.toBeNull();
  });

  it('createOrGetDirectConversation reuses the same conversation for the same pair', async (context) => {
    if (!runtime.available) {
      context.skip();
    }

    const first = await runtime.conversationService.createOrGetDirectConversation(
      'ea43bfde-4aab-4215-990a-927da133b6ce',
      '112f8d72-4ed6-4bf1-be77-85db63e03a39',
    );
    const second = await runtime.conversationService.createOrGetDirectConversation(
      '112f8d72-4ed6-4bf1-be77-85db63e03a39',
      'ea43bfde-4aab-4215-990a-927da133b6ce',
    );

    expect(first.id).toBe(second.id);
    expect(second.kind).toBe('direct');
    expect(second.participantIds).toEqual([
      '112f8d72-4ed6-4bf1-be77-85db63e03a39',
      'ea43bfde-4aab-4215-990a-927da133b6ce',
    ]);
  });
});
