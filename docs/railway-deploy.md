# Railway Deployment Runbook

This project currently deploys as **9 Railway services**:

- App services: `gateway-service`, `auth-service`, `user-service`, `chat-service`
- Infra services: `postgres`, `mysql`, `mongo`, `redis`, `rabbitmq`

Only `gateway-service` should be public. Keep the other 8 services private/internal.

---

## 1) Required Railway services

| Railway service   | Purpose                               | Used by          |
| ----------------- | ------------------------------------- | ---------------- |
| `gateway-service` | Public API entrypoint / reverse proxy | External clients |
| `auth-service`    | Registration/login/token lifecycle    | Gateway          |
| `user-service`    | User profile/search APIs              | Gateway          |
| `chat-service`    | Conversation/message + Socket.IO      | Gateway          |
| `postgres`        | User DB                               | User service     |
| `mysql`           | Auth DB                               | Auth service     |
| `mongo`           | Chat document store                   | Chat service     |
| `redis`           | Chat cache + Socket.IO adapter        | Chat service     |
| `rabbitmq`        | Event bus                             | Auth, User, Chat |

> Recommendation: use Railway-managed database/message services when available. If Mongo or RabbitMQ are Docker services, keep them private.

---

## 2) Build/deploy settings for app services

Each application service should be created from the repo root with its own Dockerfile:

| Service           | Root Directory | Dockerfile Path                       | Internal Port |
| ----------------- | -------------- | ------------------------------------- | ------------- |
| `gateway-service` | `.`            | `services/gateway-service/Dockerfile` | `4000`        |
| `auth-service`    | `.`            | `services/auth-service/Dockerfile`    | `4003`        |
| `user-service`    | `.`            | `services/user-service/Dockerfile`    | `4001`        |
| `chat-service`    | `.`            | `services/chat-service/Dockerfile`    | `4002`        |

Set the Railway health check path for every app service to `/health`.

---

## 3) Internal private URLs

Use Railway private networking between services. Typical values:

- `AUTH_SERVICE_URL=http://auth-service.railway.internal:4003`
- `USER_SERVICE_URL=http://user-service.railway.internal:4001`
- `CHAT_SERVICE_URL=http://chat-service.railway.internal:4002`
- `RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672`
- `USER_DB_URL=postgresql://<user>:<password>@postgres.railway.internal:5432/<db>`
- `AUTH_DB_URL=mysql://<user>:<password>@mysql.railway.internal:3306/<db>`
- `MONGO_URL=mongodb://<user>:<password>@mongo.railway.internal:27017/<db>?authSource=admin`
- `REDIS_URL=redis://default:<password>@redis.railway.internal:6379`

If Railway gives a different hostname for any service, use the exact value Railway shows.

---

## 4) Environment variables by service

### `gateway-service`

Railway injects `PORT` automatically. The current code also supports `GATEWAY_PORT=4000`.

```bash
NODE_ENV=production
GATEWAY_PORT=4000
AUTH_SERVICE_URL=http://auth-service.railway.internal:4003
USER_SERVICE_URL=http://user-service.railway.internal:4001
CHAT_SERVICE_URL=http://chat-service.railway.internal:4002
JWT_SECRET=<min-32-char-shared-secret>
INTERNAL_API_TOKEN=<shared-internal-token>
```

### `auth-service`

```bash
NODE_ENV=production
AUTH_SERVICE_PORT=4003
AUTH_DB_URL=mysql://<user>:<password>@mysql.railway.internal:3306/<db>
JWT_SECRET=<same-as-gateway-jwt-secret>
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=<min-32-char-refresh-secret>
JWT_REFRESH_EXPIRES_IN=30d
INTERNAL_API_TOKEN=<same-shared-internal-token>
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672
OUTBOX_ENABLED=true
OUTBOX_BATCH_SIZE=50
OUTBOX_POLL_INTERVAL_MS=2000
OUTBOX_LOCK_TIMEOUT_MS=30000
OUTBOX_MAX_ATTEMPTS=10
```

### `user-service`

`RABBITMQ_URL` is optional in code, but it should be set in Railway because this service consumes auth events and publishes user events.

```bash
NODE_ENV=production
USER_SERVICE_PORT=4001
USER_DB_URL=postgresql://<user>:<password>@postgres.railway.internal:5432/<db>
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672
INTERNAL_API_TOKEN=<same-shared-internal-token>
OUTBOX_ENABLED=true
OUTBOX_BATCH_SIZE=50
OUTBOX_POLL_INTERVAL_MS=2000
OUTBOX_LOCK_TIMEOUT_MS=30000
OUTBOX_MAX_ATTEMPTS=10
CONSUMER_DEDUPE_ENABLED=true
CONSUMER_LOCK_TIMEOUT_MS=30000
```

### `chat-service`

```bash
NODE_ENV=production
CHAT_SERVICE_PORT=4002
MONGO_URL=mongodb://<user>:<password>@mongo.railway.internal:27017/<db>?authSource=admin
REDIS_URL=redis://default:<password>@redis.railway.internal:6379
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672
INTERNAL_API_TOKEN=<same-shared-internal-token>
JWT_SECRET=<same-as-gateway-jwt-secret>
CHAT_SOCKET_ALLOWED_ORIGINS=https://<your-frontend-domain>
CONSUMER_DEDUPE_ENABLED=true
CONSUMER_LOCK_TIMEOUT_MS=30000
```

---

## 5) Copy-paste variable matrix

Fill these placeholders with Railway private URLs and your real secrets:

```bash
# Shared
NODE_ENV=production
JWT_SECRET=<min-32-char-shared-secret>
INTERNAL_API_TOKEN=<min-32-char-shared-internal-token>
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672

# Gateway
GATEWAY_PORT=4000
AUTH_SERVICE_URL=http://auth-service.railway.internal:4003
USER_SERVICE_URL=http://user-service.railway.internal:4001
CHAT_SERVICE_URL=http://chat-service.railway.internal:4002

# Auth
AUTH_SERVICE_PORT=4003
AUTH_DB_URL=mysql://<user>:<password>@mysql.railway.internal:3306/<db>
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=<min-32-char-refresh-secret>
JWT_REFRESH_EXPIRES_IN=30d
OUTBOX_ENABLED=true
OUTBOX_BATCH_SIZE=50
OUTBOX_POLL_INTERVAL_MS=2000
OUTBOX_LOCK_TIMEOUT_MS=30000
OUTBOX_MAX_ATTEMPTS=10

# User
USER_SERVICE_PORT=4001
USER_DB_URL=postgresql://<user>:<password>@postgres.railway.internal:5432/<db>
OUTBOX_ENABLED=true
OUTBOX_BATCH_SIZE=50
OUTBOX_POLL_INTERVAL_MS=2000
OUTBOX_LOCK_TIMEOUT_MS=30000
OUTBOX_MAX_ATTEMPTS=10
CONSUMER_DEDUPE_ENABLED=true
CONSUMER_LOCK_TIMEOUT_MS=30000

# Chat
CHAT_SERVICE_PORT=4002
MONGO_URL=mongodb://<user>:<password>@mongo.railway.internal:27017/<db>?authSource=admin
REDIS_URL=redis://default:<password>@redis.railway.internal:6379
CHAT_SOCKET_ALLOWED_ORIGINS=https://<your-frontend-domain>
CONSUMER_DEDUPE_ENABLED=true
CONSUMER_LOCK_TIMEOUT_MS=30000
```

---

## 6) Deploy order

1. Deploy infra first: `postgres`, `mysql`, `mongo`, `redis`, `rabbitmq`
2. Deploy backend services next: `auth-service`, `user-service`, `chat-service`
3. Deploy `gateway-service` last

If you already have the 9 services from the previous Railway project, the practical order for a refresh is:

1. Update env vars on infra-connected services first
2. Redeploy `auth-service`, `user-service`, `chat-service`
3. Redeploy `gateway-service`

---

## 7) Smoke test after deploy

Set your public gateway URL:

```bash
export GATEWAY_URL="https://<your-gateway-public-domain>"
```

### A) Health and docs checks

```bash
curl -fsS "$GATEWAY_URL/health"
curl -I "$GATEWAY_URL/docs"
curl -fsS "$GATEWAY_URL/openapi.yaml" | head
```

### B) Auth flow

```bash
curl -sS -X POST "$GATEWAY_URL/auth/register" \
  -H 'content-type: application/json' \
  -d '{"email":"railway-smoke@example.com","password":"Password123!","displayName":"Railway Smoke"}'
```

```bash
ACCESS_TOKEN=$(curl -sS -X POST "$GATEWAY_URL/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"railway-smoke@example.com","password":"Password123!"}' | jq -r '.accessToken')
```

### C) Protected routes

```bash
curl -sS "$GATEWAY_URL/users" \
  -H "authorization: Bearer $ACCESS_TOKEN"
```

```bash
curl -sS -X POST "$GATEWAY_URL/conversations" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title":"Railway Smoke","participantIds":["00000000-0000-0000-0000-000000000001"]}'
```

If those checks return successful JSON responses, the current Railway wiring is correct.
