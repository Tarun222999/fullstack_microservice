import { env } from "@/config/env";
import { ProcessedEventModel } from "@/db";
import { logger } from "@/utils/logger";
import { Op, UniqueConstraintError } from "sequelize";

export type BeginResult = "acquired" | "duplicate" | "in_progress";

const staleCutoff = () => new Date(Date.now() - env.CONSUMER_LOCK_TIMEOUT_MS);

const isUniqueConstraintError = (error: unknown): boolean => {
    if (error instanceof UniqueConstraintError) {
        return true;
    }

    if (typeof error !== "object" || error === null) {
        return false;
    }

    const candidate = error as {
        name?: string;
        original?: { code?: string };
    };

    return (
        candidate.name === "SequelizeUniqueConstraintError" ||
        candidate.original?.code === "23505"
    );
};

export const beginProcessingEvent = async (
    eventId: string,
    eventType: string,
    consumerName: string,
): Promise<BeginResult> => {
    if (!env.CONSUMER_DEDUPE_ENABLED) {
        return "acquired";
    }

    try {
        await ProcessedEventModel.create({
            eventId,
            eventType,
            consumerName,
            status: "processing",
            lockedAt: new Date(),
        });
        return "acquired";
    } catch (error: unknown) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }

        const existing = await ProcessedEventModel.findByPk(eventId);
        if (!existing) {
            return "in_progress";
        }

        if (existing.status === "processed") {
            return "duplicate";
        }

        if (existing.status === "failed") {
            const [updated] = await ProcessedEventModel.update(
                { status: "processing", lockedAt: new Date(), lastError: null, consumerName },
                { where: { eventId, status: "failed" } },
            );
            return updated > 0 ? "acquired" : "in_progress";
        }

        const [reclaimed] = await ProcessedEventModel.update(
            { lockedAt: new Date(), lastError: null, consumerName, status: "processing" },
            {
                where: {
                    eventId,
                    status: "processing",
                    [Op.or]: [{ lockedAt: null }, { lockedAt: { [Op.lte]: staleCutoff() } }],
                },
            },
        );

        if (reclaimed > 0) {
            logger.info({ eventId, consumerName }, "consumer.reclaimed");
            return "acquired";
        }

        return "in_progress";
    }
};

export const markProcessedEvent = async (eventId: string) => {
    if (!env.CONSUMER_DEDUPE_ENABLED) {
        return;
    }
    await ProcessedEventModel.update(
        {
            status: "processed",
            processedAt: new Date(),
            lockedAt: null,
            lastError: null,
        },
        { where: { eventId } },
    );
};

export const markFailedEvent = async (eventId: string, error: unknown) => {
    if (!env.CONSUMER_DEDUPE_ENABLED) {
        return;
    }
    await ProcessedEventModel.update(
        {
            status: "failed",
            lockedAt: null,
            lastError: error instanceof Error ? error.message : String(error),
        },
        { where: { eventId } },
    );
};
