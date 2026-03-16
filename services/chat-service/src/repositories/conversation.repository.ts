import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { WithId, Document } from 'mongodb';
import type { MongoServerError } from 'mongodb';

import type {
    Conversation,
    ConversationKind,
    ConversationFilter,
    ConversationSummary,
    CreateConversationInput,
} from '@/types/conversation';


import { getMongoClient } from '@/clients/mongo.client';

const CONVERSATIONS_COLLECTION = 'conversations'
const MESSAGES_COLLECTION = 'messages'
let indexesPromise: Promise<void> | null = null;

const isDuplicateKeyError = (error: unknown): error is MongoServerError =>
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: number }).code === 11000;

const ensureConversationIndexes = async (): Promise<void> => {
    if (indexesPromise) {
        return indexesPromise;
    }

    indexesPromise = (async () => {
        const client = await getMongoClient();
        const db = client.db();
        await db.collection(CONVERSATIONS_COLLECTION).createIndex(
            { directPairKey: 1 },
            {
                unique: true,
                name: 'conversations_direct_pair_key_unique',
                partialFilterExpression: {
                    kind: 'direct',
                    directPairKey: { $type: 'string' },
                },
            },
        );
    })();

    return indexesPromise;
};

const toConversation = (doc: WithId<Document>): Conversation => ({
    id: String(doc._id),
    kind: doc.kind === 'direct' ? 'direct' : 'group',
    title: typeof doc.title === 'string' ? doc.title : null,
    participantIds: Array.isArray(doc.participantIds) ? (doc.participantIds as string[]) : [],
    createdAt: new Date(doc.createdAt as string | number | Date),
    updatedAt: new Date(doc.updatedAt as string | number | Date),
    lastMessageAt: doc.lastMessageAt ? new Date(doc.lastMessageAt as string | number | Date) : null,
    lastMessagePreview: typeof doc.lastMessagePreview === 'string' ? doc.lastMessagePreview : null,
})


const toConversationSummary = (doc: WithId<Document>): ConversationSummary => toConversation(doc)

const buildConversationDocument = (
    input: CreateConversationInput,
    now: Date,
    id = randomUUID(),
): Document => ({
    _id: id,
    kind: input.kind ?? 'group',
    title: input.title ?? null,
    participantIds: input.participantIds,
    ...(input.kind === 'direct' && input.directPairKey ? { directPairKey: input.directPairKey } : {}),
    createdAt: now,
    updatedAt: now,
    lastMessageAt: null,
    lastMessagePreview: null,
});

export const conversationRepository = {
    async create(input: CreateConversationInput): Promise<Conversation> {
        await ensureConversationIndexes();
        const client = await getMongoClient()
        const db = client.db()
        const collection = db.collection(CONVERSATIONS_COLLECTION)
        const now = new Date()
        const document = buildConversationDocument(input, now);

        await collection.insertOne(document as unknown as Document)
        return toConversation(document as unknown as WithId<Document>)
    },

    async findDirectByPairKey(directPairKey: string): Promise<Conversation | null> {
        await ensureConversationIndexes();
        const client = await getMongoClient();
        const db = client.db();
        const doc = await db.collection(CONVERSATIONS_COLLECTION).findOne({
            kind: 'direct' satisfies ConversationKind,
            directPairKey,
        });

        return doc ? toConversation(doc) : null;
    },

    async createOrGetDirect(input: CreateConversationInput): Promise<Conversation> {
        await ensureConversationIndexes();
        const client = await getMongoClient();
        const db = client.db();
        const collection = db.collection(CONVERSATIONS_COLLECTION);
        const now = new Date();
        const document = buildConversationDocument(input, now);

        try {
            await collection.insertOne(document);
            return toConversation(document as unknown as WithId<Document>);
        } catch (error) {
            if (!isDuplicateKeyError(error) || !input.directPairKey) {
                throw error;
            }

            const existing = await db.collection(CONVERSATIONS_COLLECTION).findOne({
                kind: 'direct' satisfies ConversationKind,
                directPairKey: input.directPairKey,
            });

            if (!existing) {
                throw error;
            }

            return toConversation(existing);
        }
    },


    async findById(id: string): Promise<Conversation | null> {
        const client = await getMongoClient();
        const db = client.db();
        const doc = await db
            .collection(CONVERSATIONS_COLLECTION)
            .findOne({ _id: id as unknown as ObjectId });
        return doc ? toConversation(doc) : null;
    },
    async findSummaries(filter: ConversationFilter): Promise<ConversationSummary[]> {
        const client = await getMongoClient()
        const db = client.db()
        const cursor = db
            .collection(CONVERSATIONS_COLLECTION)
            .find({ participantIds: filter.participantId })
            .sort({ lastMessageAt: -1, updatedAt: -1 });

        const results = await cursor.toArray()
        return results.map((doc) => toConversationSummary(doc))
    },
    async touchConversation(conversationId: string, preview: string): Promise<void> {
        const client = await getMongoClient();
        const db = client.db();
        await db.collection(CONVERSATIONS_COLLECTION).updateOne(
            { _id: conversationId as unknown as ObjectId },
            {
                $set: {
                    lastMessageAt: new Date(),
                    lastMessagePreview: preview,
                    updatedAt: new Date(),
                },
            },
        );
    },

    async removeAll(): Promise<void> {
        const client = await getMongoClient();
        const db = client.db();
        await Promise.all([
            db.collection(CONVERSATIONS_COLLECTION).deleteMany({}),
            db.collection(MESSAGES_COLLECTION).deleteMany({}),
        ]);
    },
}
