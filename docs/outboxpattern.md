# Outbox + Consumer Idempotency Flow

## What Is Implemented
This repo now has:
- Producer-side outbox in `auth-service` and `user-service`
- Consumer-side idempotency/dedupe in `user-service` and `chat-service`

The goal is reliability with at-least-once delivery and safe duplicate handling.

## End-to-End Flow
1. Producer writes business data and outbox row in one DB transaction.
2. Outbox worker claims rows and publishes events.
3. Worker injects `metadata.eventId` from outbox row ID before publish.
4. Consumer receives message and checks `metadata.eventId`.
5. Consumer idempotency guard decides:
   - `acquired`: process handler
   - `duplicate` / `in_progress`: ack and skip
6. On success, consumer marks event `processed` and acks.
7. On failure, consumer marks event `failed` and keeps existing `nack(false,false)` policy.

## Producer Behavior
### Auth service (`auth.user.registered`)
- `register()` writes user + refresh token + outbox row when `OUTBOX_ENABLED=true`.
- Direct fallback publish path still exists when `OUTBOX_ENABLED=false`.
- Direct publish now includes `metadata.eventId` (UUID).

### User service (`user.created`)
- `createUser()` and `syncFromAuthUser()` enqueue outbox events transactionally when `OUTBOX_ENABLED=true`.
- Direct fallback publish also includes `metadata.eventId` (UUID).

## Consumer Behavior
### User service auth consumer
- Uses Postgres `processed_events` table (`event_id` unique) for dedupe state.
- Reclaims stale `processing` locks using `CONSUMER_LOCK_TIMEOUT_MS`.
- Prevents duplicate `syncFromAuthUser()` execution.

### Chat service user consumer
- Uses Mongo `processed_events` collection (`_id = eventId`) for dedupe state.
- Adds index on `{ status: 1, lockedAt: 1 }`.
- Prevents duplicate `upsertUser()` execution.

### Backward compatibility
- If `metadata.eventId` is missing, consumers log `consumer.event_id_missing`, process once, and ack.

## State Models
### Outbox states
- `pending`
- `processing`
- `published`
- `failed`
- `dead`

### Consumer dedupe states
- `processing`
- `processed`
- `failed`

## Config Flags
### Producer flags (auth/user)
- `OUTBOX_ENABLED`
- `OUTBOX_BATCH_SIZE`
- `OUTBOX_POLL_INTERVAL_MS`
- `OUTBOX_LOCK_TIMEOUT_MS`
- `OUTBOX_MAX_ATTEMPTS`

### Consumer flags (user/chat)
- `CONSUMER_DEDUPE_ENABLED` (default `true`)
- `CONSUMER_LOCK_TIMEOUT_MS`

## Files Added (high impact)
- `services/user-service/src/db/models/processed-event.model.ts`
- `services/user-service/src/messaging/consumer-idempotency.ts`
- `services/chat-service/src/repositories/processed-event.repository.ts`
- `services/user-service/src/messaging/consumer-idempotency.test.ts`
- `services/chat-service/src/repositories/processed-event.repository.test.ts`

## Validation Status
- Typecheck passed for `auth-service`, `user-service`, `chat-service`.
- `pnpm test:all` passed across workspace.
