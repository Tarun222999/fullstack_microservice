import { beforeEach, describe, expect, it, vi } from "vitest";

const envMocks = vi.hoisted(() => ({
    CONSUMER_DEDUPE_ENABLED: true,
    CONSUMER_LOCK_TIMEOUT_MS: 30_000,
}));

const modelMocks = vi.hoisted(() => ({
    create: vi.fn(),
    findByPk: vi.fn(),
    update: vi.fn(),
}));

vi.mock("@/config/env", () => ({
    env: envMocks,
}));

vi.mock("@/db", () => ({
    ProcessedEventModel: modelMocks,
}));

vi.mock("@/utils/logger", () => ({
    logger: {
        info: vi.fn(),
    },
}));

import { beginProcessingEvent, markFailedEvent, markProcessedEvent } from "@/messaging/consumer-idempotency";

describe("consumer-idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        envMocks.CONSUMER_DEDUPE_ENABLED = true;
    });

    it("returns acquired when first insert succeeds", async () => {
        modelMocks.create.mockResolvedValue({});

        const result = await beginProcessingEvent("evt-1", "auth.user.registered", "user-service.auth");

        expect(result).toBe("acquired");
        expect(modelMocks.create).toHaveBeenCalledTimes(1);
    });

    it("returns duplicate when existing row is already processed", async () => {
        modelMocks.create.mockRejectedValue(new Error("duplicate key"));
        modelMocks.findByPk.mockResolvedValue({ status: "processed" });

        const result = await beginProcessingEvent("evt-1", "auth.user.registered", "user-service.auth");

        expect(result).toBe("duplicate");
    });

    it("reclaims stale processing rows", async () => {
        modelMocks.create.mockRejectedValue(new Error("duplicate key"));
        modelMocks.findByPk.mockResolvedValue({ status: "processing", lockedAt: new Date(Date.now() - 60_000) });
        modelMocks.update.mockResolvedValue([1]);

        const result = await beginProcessingEvent("evt-2", "auth.user.registered", "user-service.auth");

        expect(result).toBe("acquired");
    });

    it("marks processed and failed states", async () => {
        await markProcessedEvent("evt-3");
        await markFailedEvent("evt-3", new Error("boom"));

        expect(modelMocks.update).toHaveBeenCalledTimes(2);
    });
});
