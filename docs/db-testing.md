# DB Testing (Local)

This repository now has dedicated DB integration test lanes for:

- `user-service` (PostgreSQL)
- `auth-service` (MySQL)
- `chat-service` (MongoDB + Redis)

All DB tests are local-only and use Testcontainers.

## Commands

From repo root:

- `pnpm test:db:user`
- `pnpm test:db:auth`
- `pnpm test:db:chat`
- `pnpm test:db:all-local`

Service-level equivalents:

- `pnpm --filter @chatapp/user-service test:db`
- `pnpm --filter @chatapp/auth-service test:db`
- `pnpm --filter chat-service test:db`

## Docker requirement

DB integration tests require a working Docker runtime.

If Docker is not available, DB suites print a skip reason and exit without failing fast/unit test lanes.

Example skip message:

`Skipped: Could not find a working container runtime strategy`
