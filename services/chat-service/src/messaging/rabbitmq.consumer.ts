import { env } from '@/config/env';
import { userRepository } from '@/repositories/user.repository';
import { logger } from '@/utils/logger';
import {
    USER_CREATED_ROUTING_KEY,
    USER_EVENTS_EXCHANGE,
    type UserCreatedEvent,
} from '@chatapp/common';

import {
    connect,
    type Channel,
    type ChannelModel,
    type ConsumeMessage,
    type Replies,
} from 'amqplib';



let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let consumerTag: string | null = null;

const EVENT_QUEUE = 'chat-service.user-events';

const closeAmqpConnection = async (conn: ChannelModel) => {
    await conn.close();
};


const handleUserCreated = async (event: UserCreatedEvent) => {
    await userRepository.upsertUser(event.payload);
};


export const startConsumers = async () => {
    if (!env.RABBITMQ_URL) {
        logger.info('RabbitMQ URL not configured; consumers disabled');
        return;
    }

    const conn = await connect(env.RABBITMQ_URL);
    connection = conn
    const ch = await conn.createChannel();
    channel = ch;

    await ch.assertExchange(USER_EVENTS_EXCHANGE, 'topic', { durable: true });
    const queue = await ch.assertQueue(EVENT_QUEUE, { durable: true });

    await ch.bindQueue(queue.queue, USER_EVENTS_EXCHANGE, USER_CREATED_ROUTING_KEY);


    const consumeHandler = (message: ConsumeMessage | null) => {
        if (!message) {
            return
        }

        void (async () => {
            const payload = message.content.toString('utf-8');
            const event = JSON.parse(payload) as UserCreatedEvent;
            await handleUserCreated(event);
            ch.ack(message);
            console.log("consumed evemt")
        })().catch((error: unknown) => {
            logger.error({ err: error }, 'Failed to process event');
            ch.nack(message, false, false);
        });
    };

    const result: Replies.Consume = await ch.consume(queue.queue, consumeHandler)
    consumerTag = result.consumerTag
    logger.info('RabbitMQ consumer started')
}


export const stopConsumers = async () => {
    try {
        const ch = channel;
        if (ch && consumerTag) {
            await ch.cancel(consumerTag);
            consumerTag = null;
        }
        if (ch) {
            await ch.close();
            channel = null;
        }
        const conn = connection;
        if (conn) {
            await closeAmqpConnection(conn);
            connection = null;
        }
    } catch (error) {
        logger.error({ err: error }, 'Error stopping RabbitMQ consumer');
    }
};
