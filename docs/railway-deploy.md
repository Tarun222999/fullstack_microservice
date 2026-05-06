# Railway Deployment Runbook

This project is a multi-service deployment. In Railway, create **10 services**:

- Application services: `gateway-service`, `auth-service`, `user-service`, `chat-service`
- Data/infra services: `postgres` (for user service), `mysql` (for auth service), `mongo` (for chat service), `redis` (for chat service), `rabbitmq` (for auth/user/chat eventing)

---

## 1) Required Railway services

| Railway service   | Purpose                               | Used by          |
| ----------------- | ------------------------------------- | ---------------- |
| `gateway-service` | Public API entrypoint / reverse proxy | External clients |
| `auth-service`    | Registration/login/token lifecycle    | Gateway          |
| `user-service`    | User profile/search APIs              | Gateway          |
| `chat-service`    | Conversation/message APIs             | Gateway          |
| `postgres`        | User DB                               | User service     |
| `mysql`           | Auth DB                               | Auth service     |
| `mongo`           | Chat document store                   | Chat service     |
| `redis`           | Chat cache/state                      | Chat service     |
| `rabbitmq`        | Event bus                             | Auth, User, Chat |

> Recommendation: use Railway-managed database/message services when available. If Mongo/Rabbit are deployed as Docker services, keep them private and only expose internal networking.

---

## 2) Railway build/deploy settings per application service

For each app service, configure Railway with the following:

| Service           | Root Directory | Dockerfile Path                       | Internal Port |
| ----------------- | -------------- | ------------------------------------- | ------------- |
| `gateway-service` | `.`            | `services/gateway-service/Dockerfile` | `4000`        |
| `auth-service`    | `.`            | `services/auth-service/Dockerfile`    | `4003`        |
| `user-service`    | `.`            | `services/user-service/Dockerfile`    | `4001`        |
| `chat-service`    | `.`            | `services/chat-service/Dockerfile`    | `4002`        |

---

## 3) Internal private service URLs (Railway networking)

Use private networking between services. Example internal URLs:

- `AUTH_SERVICE_URL=http://auth-service.railway.internal:4003`
- `USER_SERVICE_URL=http://user-service.railway.internal:4001`
- `CHAT_SERVICE_URL=http://chat-service.railway.internal:4002`
- `RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672`
- `USER_DB_URL=postgresql://<user>:<password>@postgres.railway.internal:5432/<db>`
- `AUTH_DB_URL=mysql://<user>:<password>@mysql.railway.internal:3306/<db>`
- `MONGO_URL=mongodb://<user>:<password>@mongo.railway.internal:27017/<db>?authSource=admin`
- `REDIS_URL=redis://default:<password>@redis.railway.internal:6379`

If Railway gives your service different private hostnames, use those exact values.

---

## 4) Required environment variables by service

### `gateway-service`

```bash
NODE_ENV=production
GATEWAY__PORT=4000
AUTH_SERVICE_URL=http://auth-service.railway.internal:4003
USER_SERVICE_URL=http://user-service.railway.internal:4001
CHAT_SERVICE_URL=http://chat-service.railway.internal:4002
GATEWAY_ALLOWED_ORIGINS=http://localhost:5173,https://<your-frontend-domain>
JWT_SECRET=<min-32-char-shared-secret>
INTERNAL_API_TOKEN=<min-32-char-shared-internal-token>
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
```

### `user-service`

```bash
NODE_ENV=production
USER_SERVICE_PORT=4001
USER_DB_URL=postgresql://<user>:<password>@postgres.railway.internal:5432/<db>
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672
INTERNAL_API_TOKEN=<same-shared-internal-token>
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
```

---

## 5) Copy-paste variable matrix (single source of truth)

Use this as a checklist/template to avoid missing secrets. Fill all placeholders before deploy.

```bash
# ==============================
# Shared
# ==============================
NODE_ENV=production
JWT_SECRET=<min-32-char-shared-secret>
INTERNAL_API_TOKEN=<min-32-char-shared-internal-token>

# ==============================
# Gateway service
# ==============================
GATEWAY__PORT=4000
AUTH_SERVICE_URL=http://auth-service.railway.internal:4003
USER_SERVICE_URL=http://user-service.railway.internal:4001
CHAT_SERVICE_URL=http://chat-service.railway.internal:4002
GATEWAY_ALLOWED_ORIGINS=http://localhost:5173,https://<your-frontend-domain>

# ==============================
# Auth service
# ==============================
AUTH_SERVICE_PORT=4003
AUTH_DB_URL=mysql://<user>:<password>@mysql.railway.internal:3306/<db>
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=<min-32-char-refresh-secret>
JWT_REFRESH_EXPIRES_IN=30d

# ==============================
# User service
# ==============================
USER_SERVICE_PORT=4001
USER_DB_URL=postgresql://<user>:<password>@postgres.railway.internal:5432/<db>

# ==============================
# Chat service
# ==============================
CHAT_SERVICE_PORT=4002
MONGO_URL=mongodb://<user>:<password>@mongo.railway.internal:27017/<db>?authSource=admin
REDIS_URL=redis://default:<password>@redis.railway.internal:6379

# ==============================
# Messaging
# ==============================
RABBITMQ_URL=amqp://<user>:<password>@rabbitmq.railway.internal:5672
```

---

## 6) Startup order and health checks

### Expected startup order

1. Data/infra first: `postgres`, `mysql`, `mongo`, `redis`, `rabbitmq`
2. Backend services next (parallel is okay once dependencies are healthy): `auth-service`, `user-service`, `chat-service`
3. `gateway-service` last (depends on all backend APIs being reachable)

### Health check endpoints

- `gateway-service`: `GET /health`
- `auth-service`: `GET /health`
- `user-service`: `GET /health`
- `chat-service`: `GET /health`

In Railway, configure each service health check path as `/health`.

---

## 7) Minimum smoke test after deploy

Set your public gateway URL:

```bash
export GATEWAY_URL="https://<your-gateway-public-domain>"
```

### A) Health checks

```bash
curl -fsS "$GATEWAY_URL/health"
curl -fsS "http://auth-service.railway.internal:4003/health"
curl -fsS "http://user-service.railway.internal:4001/health"
curl -fsS "http://chat-service.railway.internal:4002/health"
```

### B) Auth -> User -> Chat request chain

1. Register a user through gateway auth:

```bash
curl -sS -X POST "$GATEWAY_URL/auth/register" \
  -H 'content-type: application/json' \
  -d '{"email":"railway-smoke@example.com","password":"Password123!","displayName":"Railway Smoke"}'
```

2. Login and capture access token:

```bash
ACCESS_TOKEN=$(curl -sS -X POST "$GATEWAY_URL/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"railway-smoke@example.com","password":"Password123!"}' | jq -r '.accessToken')

echo "$ACCESS_TOKEN" | head -c 24 && echo
```

3. Create/get user data via gateway user API:

```bash
curl -sS "$GATEWAY_URL/users" \
  -H "authorization: Bearer $ACCESS_TOKEN"
```

4. Create a conversation (self + another UUID participant for schema validation):

```bash
curl -sS -X POST "$GATEWAY_URL/conversations" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title":"Railway Smoke","participantIds":["00000000-0000-0000-0000-000000000001"]}'
```

If all four steps succeed (2xx responses, valid JSON), deployment wiring is correct.
