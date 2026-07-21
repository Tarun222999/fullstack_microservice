import { env } from '@/config/env';
import { OutboxEvent } from '@/models';
import { logger } from '@/utils/logger';
import {
  AUTH_EVENT_EXCHANGE,
  AUTH_USER_REGISTERED_ROUTING_KEY,
  captureTraceCarrier,
  runWithBusinessSpan,
  runWithBusinessSpanFromCarrier,
  type AuthUserRegisteredPayload,
  type TraceCarrier,
} from '@chatapp/common';
import { Op } from 'sequelize';
import { Channel, connect, type ChannelModel } from 'amqplib';

let connectionRef: ChannelModel | null = null;
let channel: Channel | null = null;
let outboxTimer: NodeJS.Timeout | null = null;
const workerId = `auth-outbox-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

export const initPublisher = async () => {
  if (!env.RABBITMQ_URL) {
    logger.warn('RabbitMQ is not defined.SkiipingRabbitMQ intilization');
    return;
  }

  if (channel) {
    return;
  }

  const connection = await connect(env.RABBITMQ_URL);
  connectionRef = connection;
  channel = await connection.createChannel();
  await channel.assertExchange(AUTH_EVENT_EXCHANGE, 'topic', { durable: true });

  connection.on('close', () => {
    logger.warn('RabbitMq connection closed');
    channel = null;
    connectionRef = null;
  });

  connection.on('error', (err) => {
    logger.error({ err }, 'RabbitMq Connection Error');
  });

  logger.info('Auth Service RabbitMQ Publisher Intialized');
};

const publishOutboxRow = async (row: OutboxEvent) => {
  const ch = channel;
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
    'auth.outbox.publish',
    {
      'messaging.system': 'rabbitmq',
      'messaging.destination.name': row.exchangeName,
      'messaging.rabbitmq.routing_key': row.routingKey,
      'event.type': row.eventType,
      'event.id': metadata?.eventId ?? row.id,
    },
    () => {
      const published = ch.publish(
        row.exchangeName,
        row.routingKey,
        Buffer.from(JSON.stringify(eventWithId)),
        {
          contentType: 'application/json',
          persistent: true,
          headers: metadata?.traceCarrier,
        },
      );
      if (!published) {
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
            {
              status: 'processing',
              lockedAt: { [Op.lte]: staleCutoff },
            },
          ],
        },
      },
    );
    if (claimed === 0) {
      continue;
    }

    try {
      await publishOutboxRow(row);
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
      const attempts = row.attempts + 1;
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
  try {
    await processOutboxBatch();
  } catch (error) {
    logger.error({ err: error }, 'Failed processing auth outbox batch');
  }
};

export const startOutboxPublisher = async () => {
  if (!env.OUTBOX_ENABLED || outboxTimer) {
    return;
  }
  outboxTimer = setInterval(() => {
    void pollOutbox();
  }, env.OUTBOX_POLL_INTERVAL_MS);
  await pollOutbox();
  logger.info('Auth outbox publisher started');
};

export const stopOutboxPublisher = async () => {
  if (!outboxTimer) {
    return;
  }
  clearInterval(outboxTimer);
  outboxTimer = null;
};

export const publishingUserRegistered = async (payload: AuthUserRegisteredPayload) => {
  if (!channel) {
    logger.warn('RabbitMQ channel is not initialized.Cannot publish message');
    return;
  }

  const traceCarrier = captureTraceCarrier();

  const event = {
    type: AUTH_USER_REGISTERED_ROUTING_KEY,
    payload,
    occuredAt: new Date().toISOString(),
    metadata: { version: 1, eventId: crypto.randomUUID(), traceCarrier },
  };

  await runWithBusinessSpan(
    'auth.user_registered.publish',
    {
      'messaging.system': 'rabbitmq',
      'messaging.destination.name': AUTH_EVENT_EXCHANGE,
      'messaging.rabbitmq.routing_key': AUTH_USER_REGISTERED_ROUTING_KEY,
      'event.type': AUTH_USER_REGISTERED_ROUTING_KEY,
      'event.id': event.metadata.eventId,
    },
    () => {
      const published = channel?.publish(
        AUTH_EVENT_EXCHANGE,
        AUTH_USER_REGISTERED_ROUTING_KEY,
        Buffer.from(JSON.stringify(event)),
        {
          contentType: 'application/json',
          persistent: true,
          headers: traceCarrier,
        },
      );

      if (!published) {
        logger.warn({ event }, 'Failed to publish user registered event');
      }
    },
  );
};

export const closePublisher = async () => {
  try {
    const ch = channel;
    if (ch) {
      await ch.close();
      channel = null;
    }

    const conn = connectionRef;
    if (conn) {
      await conn.close();
      connectionRef = null;
    }
  } catch (error) {
    logger.error({ err: error }, 'Error close RabbitMQ connection/channel');
  }
};
