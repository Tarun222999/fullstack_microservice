import { randomUUID } from 'node:crypto';

import { type WithId, type Document } from 'mongodb';

import type { Message, MessageListOptions } from '@/types/message';

import { getMongoClient } from '@/clients/mongo.client';

const MESSAGES_COLLECTION = 'messages';

interface MessageRepositoryListOptions extends Omit<MessageListOptions, 'beforeMessageId'> {
    before?: {
        id: string;
        createdAt: Date;
    };
}


const toMessage = (doc: WithId<Document>): Message => ({
    id: String(doc._id),
    conversationId: String(doc.conversationId),
    senderId: String(doc.senderId),
    body: String(doc.body),
    createdAt: new Date(doc.createdAt as string | number | Date),
    reactions: Array.isArray(doc.reactions)
        ? doc.reactions.map((r: WithId<Document>) => ({
            emoji: String(r.emoji),
            userId: String(r.userId),
            createdAt: new Date(r.createdAt as string | number | Date),
        }))
        : [],
});


export const messageRepository = {
    async create(conversationId: string, senderId: string, body: string): Promise<Message> {
        const client = await getMongoClient();
        const db = client.db();
        const collection = db.collection(MESSAGES_COLLECTION);
        const now = new Date();
        const document = {
            _id: randomUUID(),
            conversationId,
            senderId,
            body,
            createdAt: now,
        };

        await collection.insertOne(document as unknown as Document);

        return toMessage(document as unknown as WithId<Document>);
    },

    async findByConversation(
        conversationId: string,
        options: MessageRepositoryListOptions = {},
    ): Promise<Message[]> {
        const client = await getMongoClient();
        const db = client.db();
        const query: Record<string, unknown> = {
            conversationId,
        };
        if (options.before) {
            query.$or = [
                {
                    createdAt: { $lt: options.before.createdAt },
                },
                {
                    createdAt: options.before.createdAt,
                    _id: { $lt: options.before.id },
                },
            ];
        }
        if (options.after) {
            query.createdAt = { $gt: options.after };
        }

        const cursor = db
            .collection(MESSAGES_COLLECTION)
            .find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(options.limit ?? 50);

        const messages = await cursor.toArray();
        return messages.map((doc) => toMessage(doc));
    },

    async findById(messageId: string): Promise<Message | null> {
        const client = await getMongoClient();
        const db = client.db();
        const doc = await db
            .collection(MESSAGES_COLLECTION)
            .findOne({ _id: messageId } as unknown as Document);
        return doc ? toMessage(doc) : null;
    },
};
