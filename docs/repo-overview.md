# Fullstack Microservice Repo Overview

## 1) Architecture

This repository is a TypeScript monorepo (`pnpm` workspaces) built around microservices, with one shared package:

- `services/gateway-service`
- `services/auth-service`
- `services/user-service`
- `services/chat-service`
- `packages/common`

### Runtime topology

- Public entrypoint: `gateway-service` (HTTP API facade)
- Internal services:
  - `auth-service` for identity and token lifecycle
  - `user-service` for user profile/search data
  - `chat-service` for conversations/messages
- Messaging backbone: RabbitMQ
- Datastores:
  - Auth: MySQL (Sequelize)
  - User: PostgreSQL (Sequelize)
  - Chat: MongoDB (native driver)
  - Cache: Redis (conversation cache in chat service)

All services are orchestrated via `docker-compose.yaml` and communicate over a private Docker network.

## 2) Patterns Used

### Service decomposition / bounded contexts

Each service owns a domain slice and datastore, which is a solid microservice boundary:

- Auth credentials + refresh tokens in auth service
- User directory in user service
- Conversation/message docs in chat service

### API Gateway pattern

`gateway-service` proxies incoming client calls to internal services using dedicated proxy services (`auth-proxy`, `user-proxy`, `chat-proxy`).

### Event-driven integration (async)

- Auth publishes `auth.user.registered`
- User consumes auth event and upserts local user
- User publishes `user.created`
- Chat consumes user event and upserts lightweight user projection

This is an eventual-consistency pattern using RabbitMQ topic exchanges.

### Layered structure inside services

Most services follow:

- `routes -> controller -> service -> repository -> db client/model`

This improves separation of concerns and keeps business logic out of routing.

### Shared platform package

`packages/common` centralizes:

- input validation middleware
- internal service auth middleware
- shared error type (`HttpError`)
- shared event contracts/constants
- env helper

### Read-through cache pattern

`chat-service` uses Redis for conversation lookup cache with TTL and explicit invalidation on updates.

## 3) Functionality Offered Today

### Authentication and session flows

- Register user
- Login
- Refresh token
- Revoke refresh tokens

### User APIs

- Create user
- Get user by ID
- List all users
- Search users by display name/email with exclusion support

### Chat APIs

- Create conversation
- List user conversations
- Get a conversation by ID (participant check)
- Create message in conversation
- List messages in conversation (with pagination-like params)

### Operational baseline

- Health endpoints on all services
- Dockerized deployment
- Railway deployment runbook in `docs/railway-deploy.md`

## 4) Current Negatives / Gaps

### Testing gap (highest priority)

- Service `test` scripts are placeholders (`"No tests yet"`).
- No automated regression safety net for API contracts, auth, event flows, or data behavior.

### Security posture is too permissive

- `cors({ origin: "*", credentials: true })` is unsafe for production hardening.
- Internal auth relies on a single static vices.
- Several files still have detoken header between serbug `console.log(...)` statements, including auth-related paths.

### Reliability and delivery guarantees

- Event publishing is outside DB transaction boundaries (possible write/publish mismatch windows).
- No outbox pattern for exactly-once-ish delivery or robust replay/recovery.
- Some shutdown paths do not close all messaging/database resources consistently.

### Data and schema lifecycle concerns

- `sequelize.sync({ alter: true })` in non-dev for user-service is risky for production schema control.
- No explicit migration workflow/versioned DB migrations.
- Multiple storage technologies increase operational complexity (MySQL + Postgres + Mongo + Redis).

### Consistency and maintainability issues

- Naming inconsistencies/typos (`GATEWAY__PORT`, spelling mismatches, log message mistakes).
- Mixed response status conventions (`201` for read paths in some chat handlers).
- Duplicate/overlapping user creation paths (direct create endpoint + event sync path) can create ownership ambiguity.

### Observability and operations

- Logging is present but not standardized around correlation IDs or trace context.
- No metrics, distributed tracing, or alerting hooks are visible in-repo.
- Retry/circuit-breaker behavior for gateway->service calls is minimal.

## 5) What to Improve Next (Practical Plan)

1. Introduce automated tests first:
   - unit tests for service/repository logic
   - integration tests for auth/user/chat APIs
   - event flow tests for RabbitMQ consumers/producers
2. Harden security:
   - restrict CORS origins by environment
   - remove debug logs and avoid logging secrets/tokens
   - consider mTLS/service identity or signed internal requests instead of a single shared token
3. Stabilize data change management:
   - adopt migration tooling (e.g., Sequelize migrations)
   - stop relying on runtime `alter` in production
4. Increase event reliability:
   - adopt an outbox pattern for producer services
   - add dead-letter queues and replay tooling
5. Improve observability:
   - structured logs with request/event correlation IDs
   - Prometheus/OpenTelemetry instrumentation
6. Reduce interface drift:
   - standardize status codes and error payload shape
   - define and enforce API contracts (OpenAPI or shared typed client contracts)

## 6) Summary

This repo already has a strong foundation: clear service boundaries, shared validation/error primitives, gateway-based ingress, and event-driven integration. The largest risks are not architecture choice, but production hardening gaps: testing, security tightening, migration discipline, and reliability/observability maturity.
