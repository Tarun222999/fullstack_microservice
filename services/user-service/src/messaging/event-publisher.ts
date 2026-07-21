import {
  USER_CREATED_ROUTING_KEY,
  USER_EVENTS_EXCHANGE,
  captureTraceCarrier,
  runWithBusinessSpan,
  runWithBusinessSpanFromCarrier,
  type TraceCarrier,
} from '@chatapp/common';
import amqplib from 'amqplib';
import { Op } from 'sequelize';

import type { UserCreatedEvent, UserCreatedPayload } from '@chatapp/common';
import type { Channel, ChannelModel, Connection } from 'amqplib';

import { OutboxEvent } from '@/db';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

type ManagedConnection = Connection & Pick<ChannelModel, 'close' | 'createChannel'>;

let connection: ManagedConnection | null = null;
let channel: Channel | null = null;
let outboxTimer: NodeJS.Timeout | null = null;
let outboxInFlight: Promise<void> | null = null;
const workerId = `user-outbox-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

const messagingEnabled = Boolean(env.RABBITMQ_URL);

const ensureChannel = async (): Promise<Channel | null> => {
  if (!messagingEnabled) {
    return null;
  }

  if (channel) {
    return channel;
  }

  if (!env.RABBITMQ_URL) {
    return null;
  }

  const amqpConnection = (await amqplib.connect(env.RABBITMQ_URL)) as unknown as ManagedConnection;

  connection = amqpConnection;

  amqpConnection.on('close', () => {
    logger.warn('RabbitMQ connection closed');
    connection = null;
    channel = null;
  });
  amqpConnection.on('error', (error) => {
    logger.error({ err: error }, 'RabbitMQ connection error');
  });
  const amqpChannel = await amqpConnection.createChannel();
  channel = amqpChannel;
  await amqpChannel.assertExchange(USER_EVENTS_EXCHANGE, 'topic', { durable: true });
  return amqpChannel;
};

export const initMessaging = async () => {
  if (!messagingEnabled) {
    logger.info('Rabbitmq url is not configured;messaging disabled');
    return;
  }

  await ensureChannel();
  logger.info('User service RabbitMq publisher initializes');
};

export const closeMessaging = async () => {
  try {
    if (channel) {
      const currentChannel: Channel = channel;
      channel = null;
      await currentChannel.close();
    }
    if (connection) {
      const currentConnection: ManagedConnection = connection;
      connection = null;
      await currentConnection.close();
    }

    logger.info('User service RabbitMQ publisher closed');
  } catch (error) {
    logger.error({ err: error }, 'Error closing RabbitMQ connection/channel');
  }
};

const publishOutboxRow = async (row: OutboxEvent) => {
  const ch = await ensureChannel();
  if (!ch) {
    throw new Error('RabbitMQ channel is not initialized');
  }
  const metadata = row.metadataJson
    ? (JSON.parse(row.metadataJson) as { eventId?: string; traceCarrier?: TraceCarrier })
    : undefined;
  const rawEvent = JSON.parse(row.payloadJson) as { metadata?: Record<string, unknown> };
  const eventWithId = {
    ...rawEvent,
    metadata: {
      ...(rawEvent.metadata ?? {}),
      eventId: row.id,
      ...(metadata?.traceCarrier ? { traceCarrier: metadata.traceCarrier } : {}),
    },
  };

  await runWithBusinessSpanFromCarrier(
    metadata?.traceCarrier,
    'user.outbox.publish',
    {
      'messaging.system': 'rabbitmq',
      'messaging.destination.name': row.exchangeName,
      'messaging.rabbitmq.routing_key': row.routingKey,
      'event.type': row.eventType,
      'event.id': metadata?.eventId ?? row.id,
    },
    () => {
      const success = ch.publish(
        row.exchangeName,
        row.routingKey,
        Buffer.from(JSON.stringify(eventWithId)),
        {
          contentType: 'application/json',
          persistent: true,
          headers: metadata?.traceCarrier,
        },
      );
      if (!success) {
        throw new Error('Failed to publish outbox event');
      }
    },
  );
};

const computeBackoffMs = (attempts: number) =>
  Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts - 1));

const processOutboxBatch = async () => {
  if (!env.OUTBOX_ENABLED) {
    return;
  }

  const now = new Date();
  const staleCutoff = new Date(now.getTime() - env.OUTBOX_LOCK_TIMEOUT_MS);
  const candidates = await OutboxEvent.findAll({
    where: {
      [Op.or]: [
        {
          status: { [Op.in]: ['pending', 'failed'] },
          [Op.or]: [{ nextAttemptAt: null }, { nextAttemptAt: { [Op.lte]: now } }],
        },
        {
          status: 'processing',
          lockedAt: { [Op.lte]: staleCutoff },
        },
      ],
    },
    order: [['createdAt', 'ASC']],
    limit: env.OUTBOX_BATCH_SIZE,
  });

  for (const row of candidates) {
    const [claimed] = await OutboxEvent.update(
      { status: 'processing', lockedAt: new Date(), lockedBy: workerId },
      {
        where: {
          id: row.id,
          [Op.or]: [
            { status: { [Op.in]: ['pending', 'failed'] } },
            { status: 'processing', lockedAt: { [Op.lte]: staleCutoff } },
          ],
        },
      },
    );
    if (claimed === 0) {
      continue;
    }

    try {
      const freshRow = await OutboxEvent.findByPk(row.id);
      if (!freshRow) {
        continue;
      }
      await publishOutboxRow(freshRow);
      await OutboxEvent.update(
        {
          status: 'published',
          publishedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
        },
        { where: { id: row.id } },
      );
    } catch (error) {
      const freshRow = await OutboxEvent.findByPk(row.id);
      const attempts = (freshRow?.attempts ?? row.attempts) + 1;
      const shouldDeadLetter = attempts >= env.OUTBOX_MAX_ATTEMPTS;
      await OutboxEvent.update(
        {
          status: shouldDeadLetter ? 'dead' : 'failed',
          attempts,
          nextAttemptAt: shouldDeadLetter
            ? null
            : new Date(Date.now() + computeBackoffMs(attempts)),
          lockedAt: null,
          lockedBy: null,
          lastError: error instanceof Error ? error.message : String(error),
        },
        { where: { id: row.id } },
      );
    }
  }
};

const pollOutbox = async () => {
  if (outboxInFlight) {
    return outboxInFlight;
  }

  outboxInFlight = (async () => {
    try {
      await processOutboxBatch();
    } catch (error) {
      logger.error({ err: error }, 'Failed processing user outbox batch');
    }
  })().finally(() => {
    outboxInFlight = null;
  });

  return outboxInFlight;
};

export const startOutboxPublisher = async () => {
  if (!env.OUTBOX_ENABLED || outboxTimer) {
    return;
  }

  outboxTimer = setInterval(() => {
    void pollOutbox();
  }, env.OUTBOX_POLL_INTERVAL_MS);
  await pollOutbox();
  logger.info('User outbox publisher started');
};

export const stopOutboxPublisher = async () => {
  if (!outboxTimer) {
    return;
  }
  clearInterval(outboxTimer);
  outboxTimer = null;
  if (outboxInFlight) {
    await outboxInFlight;
  }
};

export const publishUserCreatedEvent = async (payload: UserCreatedPayload) => {
  const ch = await ensureChannel();

  if (!ch) {
    logger.debug({ payload }, 'Skipping user.created event publish; messaging disabled');
    return;
  }

  const traceCarrier = captureTraceCarrier();
  const event: UserCreatedEvent = {
    type: USER_CREATED_ROUTING_KEY,
    payload,
    occuredAt: new Date().toISOString(),
    metadata: { version: 1, eventId: crypto.randomUUID(), traceCarrier } as Record<string, unknown>,
  };

  try {
    await runWithBusinessSpan(
      'user.created.publish',
      {
        'messaging.system': 'rabbitmq',
        'messaging.destination.name': USER_EVENTS_EXCHANGE,
        'messaging.rabbitmq.routing_key': USER_CREATED_ROUTING_KEY,
        'event.type': USER_CREATED_ROUTING_KEY,
        'event.id': (event.metadata as { eventId: string }).eventId,
      },
      () => {
        const success = ch.publish(
          USER_EVENTS_EXCHANGE,
          USER_CREATED_ROUTING_KEY,
          Buffer.from(JSON.stringify(event)),
          {
            contentType: 'application/json',
            persistent: true,
            headers: traceCarrier,
          },
        );
        if (!success) {
          logger.warn({ event }, 'Failed to publish user.created event');
        }
      },
    );
  } catch (error) {
    logger.error({ err: error }, 'Error publishing user.created event');
  }
};
