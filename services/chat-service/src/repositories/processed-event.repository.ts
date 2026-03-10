import type { Collection } from "mongodb";

import { env } from "@/config/env";
import { getMongoClient } from "@/clients/mongo.client";
import { logger } from "@/utils/logger";

export type BeginResult = "acquired" | "duplicate" | "in_progress";

interface ProcessedEventDocument {
    _id: string;
    eventType: string;
    consumerName: string;
    status: "processing" | "processed" | "failed";
    lockedAt: Date | null;
    processedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const COLLECTION_NAME = "processed_events";

const getCollection = async (): Promise<Collection<ProcessedEventDocument>> => {
    const client = await getMongoClient();
    return client.db().collection<ProcessedEventDocument>(COLLECTION_NAME);
};

export const ensureProcessedEventIndexes = async () => {
    const collection = await getCollection();
    await collection.createIndex({ status: 1, lockedAt: 1 });
};

const staleCutoff = () => new Date(Date.now() - env.CONSUMER_LOCK_TIMEOUT_MS);

export const beginProcessingEvent = async (
    eventId: string,
    eventType: string,
    consumerName: string,
): Promise<BeginResult> => {
    if (!env.CONSUMER_DEDUPE_ENABLED) {
        return "acquired";
    }

    const collection = await getCollection();
    const now = new Date();

    try {
        await collection.insertOne({
            _id: eventId,
            eventType,
            consumerName,
            status: "processing",
            lockedAt: now,
            processedAt: null,
            lastError: null,
            createdAt: now,
            updatedAt: now,
        });
        return "acquired";
    } catch (error: any) {
        if (error?.code !== 11000) {
            throw error;
        }
    }

    const existing = await collection.findOne({ _id: eventId });
    if (!existing) {
        return "in_progress";
    }

    if (existing.status === "processed") {
        return "duplicate";
    }

    if (existing.status === "failed") {
        const updated = await collection.updateOne(
            { _id: eventId, status: "failed" },
            {
                $set: {
                    status: "processing",
                    lockedAt: now,
                    lastError: null,
                    consumerName,
                    updatedAt: now,
                },
            },
        );
        return updated.modifiedCount > 0 ? "acquired" : "in_progress";
    }

    const reclaimed = await collection.updateOne(
        {
            _id: eventId,
            status: "processing",
            $or: [{ lockedAt: null }, { lockedAt: { $lte: staleCutoff() } }],
        },
        {
            $set: {
                lockedAt: now,
                consumerName,
                lastError: null,
                updatedAt: now,
            },
        },
    );

    if (reclaimed.modifiedCount > 0) {
        logger.info({ eventId, consumerName }, "consumer.reclaimed");
        return "acquired";
    }

    return "in_progress";
};

export const markProcessedEvent = async (eventId: string) => {
    if (!env.CONSUMER_DEDUPE_ENABLED) {
        return;
    }
    const collection = await getCollection();
    await collection.updateOne(
        { _id: eventId },
        {
            $set: {
                status: "processed",
                processedAt: new Date(),
                lockedAt: null,
                lastError: null,
                updatedAt: new Date(),
            },
        },
    );
};

export const markFailedEvent = async (eventId: string, error: unknown) => {
    if (!env.CONSUMER_DEDUPE_ENABLED) {
        return;
    }
    const collection = await getCollection();
    await collection.updateOne(
        { _id: eventId },
        {
            $set: {
                status: "failed",
                lockedAt: null,
                lastError: error instanceof Error ? error.message : String(error),
                updatedAt: new Date(),
            },
        },
    );
};
