# Chat Invite Email Feature Plan

## Summary

Add a simple chat invitation email flow for the private chat UI.

The frontend will collect:

- invitee email address
- invite URL

The frontend will call the public gateway API. Gateway will validate the request and call the internal Go email service. The email service will send one invitation email through Resend.

This feature intentionally does not include:

- storing invites in a database
- checking whether the invitee is already a registered user
- retry queues
- worker pools
- SMTP or Mailpit
- RabbitMQ-based delivery
- invite acceptance tracking

The first version is a direct request/response flow:

```text
Frontend
  -> gateway-service
    -> email-service
      -> Resend API
```

## Goals

- Turn the current Go email worker demo into a real HTTP microservice.
- Keep the email service small and production-shaped.
- Use Resend for email delivery instead of SMTP.
- Keep gateway as the only public backend entrypoint.
- Follow the existing project pattern of internal service calls protected by `INTERNAL_API_TOKEN`.
- Avoid adding new persistence or queueing until the feature needs it.

## Non-Goals

- No invitation database table.
- No deduplication of invited emails.
- No user lookup before sending an invite.
- No automatic direct conversation creation.
- No asynchronous job persistence.
- No bulk email sending.
- No email analytics, tracking, or unsubscribe system.

## Phase 1: Rewrite Email Service

### Current State

The current email service is a learning prototype:

- reads recipients from `emails.csv`
- uses Go channels and worker goroutines
- sends through local SMTP
- renders `email.tmpl`
- runs as a command, not an HTTP service

### Target State

The email service becomes a small Go HTTP service with:

- `GET /health`
- `POST /emails/chat-invite`
- internal token validation
- request body validation
- Resend API integration
- structured JSON responses
- no database
- no worker pool

### Request Contract

Gateway calls:

```http
POST /emails/chat-invite
X-Internal-Token: <internal-token>
Content-Type: application/json
```

```json
{
  "to": "friend@example.com",
  "inviteUrl": "https://app.example.com/invite/abc",
  "inviterName": "Tarun"
}
```

### Response Contract

Success:

```http
200 OK
```

```json
{
  "data": {
    "id": "resend-email-id"
  }
}
```

Validation error:

```http
400 Bad Request
```

```json
{
  "message": "Invalid request body"
}
```

Unauthorized internal call:

```http
401 Unauthorized
```

```json
{
  "message": "Unauthorized"
}
```

Provider failure:

```http
502 Bad Gateway
```

```json
{
  "message": "Email provider request failed"
}
```

### Environment Variables

Email service:

```text
EMAIL_SERVICE_PORT=4004
INTERNAL_API_TOKEN=...
RESEND_API_KEY=...
EMAIL_FROM="Chat App <invites@example.com>"
APP_NAME="Chat App"
```

### Email Content

Subject:

```text
You were invited to chat on Chat App
```

Body should include:

- inviter name when provided
- invite URL
- simple fallback copy if inviter name is missing

Example plain-text body:

```text
Tarun invited you to chat on Chat App.

Open this link to join:
https://app.example.com/invite/abc
```

HTML can be added in the same phase if it stays simple. Plain text is enough for the first working version.

### Implementation Steps

1. Replace command-style `main.go` with an HTTP server.
2. Add a small config loader for required environment variables.
3. Add `GET /health`.
4. Add internal auth middleware using `X-Internal-Token`.
5. Add `POST /emails/chat-invite`.
6. Validate:
   - `to` is an email-shaped string
   - `inviteUrl` is an absolute `http` or `https` URL
   - `inviterName` is optional and length-limited
7. Add a Resend client using Go standard library `net/http`.
8. Return clear JSON error responses.
9. Add Go unit tests for validation and handler behavior where practical.
10. Run `go test ./...`.

### Why No Workers In Phase 1

The current feature sends one email for one user action. A worker pool would add complexity but not much value.

An in-memory worker queue also creates a reliability gap: the service can accept a job and then lose it if the process restarts before sending. Since there is no durable queue or database in scope, synchronous sending is simpler and more honest.

The first version should only return success after Resend accepts the email request.

## Deferred Phase: Branded Email Template

### Target State

The invite email should feel like it belongs to the chat product, not like a generic system email.

This phase is intentionally deferred until after the plain invite flow is wired and tested end to end.

The branded template should include:

- app name
- short invitation headline
- inviter name when available
- clear call-to-action link
- fallback plain-text body
- restrained visual styling that works in common email clients

### Branding Inputs

The service should keep branding configurable through environment variables instead of hardcoding final product identity too deeply:

```text
APP_NAME="Chat App"
EMAIL_FROM="Chat App <invites@example.com>"
BRAND_PRIMARY_COLOR="#2563eb"
BRAND_TEXT_COLOR="#111827"
BRAND_MUTED_COLOR="#6b7280"
```

The exact app name, sender domain, and colors can be finalized later when the frontend branding is clearer.

### Template Rules

- Keep the HTML simple and email-client friendly.
- Use inline styles instead of depending on external CSS.
- Always send both `html` and `text` content.
- Make the invite URL visible in the plain-text fallback.
- Avoid adding tracking pixels or analytics in this phase.

### Implementation Steps

1. Add a template renderer inside email-service.
2. Generate both HTML and plain-text invite bodies.
3. Keep the existing `/emails/chat-invite` API unchanged.
4. Add tests for the template content.
5. Let the user review copy and visual direction before wiring the frontend.

## Phase 3: Dockerize Email Service

### Target State

The Go service gets its own Dockerfile:

```text
services/email-service/Dockerfile
```

The Dockerfile should use a multi-stage build:

- build with `golang:<version>-alpine`
- run with a small Alpine image
- expose port `4004`
- run the compiled email service binary

### Implementation Steps

1. Add `services/email-service/Dockerfile`.
2. Ensure the build context works from repository root.
3. Add `email-service` to `docker-compose.yaml`.
4. Add healthcheck for `GET /health`.
5. Add service environment variables.
6. Put the service on `chatapp-network`.

### Compose Shape

```yaml
email-service:
  build:
    context: .
    dockerfile: services/email-service/Dockerfile
  container_name: chatapp-email-service
  ports:
    - '${EMAIL_SERVICE_PORT:-4004}:4004'
  environment:
    EMAIL_SERVICE_PORT: ${EMAIL_SERVICE_PORT:-4004}
    INTERNAL_API_TOKEN: ${INTERNAL_API_TOKEN}
    RESEND_API_KEY: ${RESEND_API_KEY}
    EMAIL_FROM: ${EMAIL_FROM}
    APP_NAME: ${APP_NAME:-Chat App}
  networks:
    - chatapp-network
```

## Phase 4: Gateway Wiring

### Target State

Gateway exposes a public authenticated endpoint:

```http
POST /chat-invites
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "email": "friend@example.com",
  "inviteUrl": "https://app.example.com/invite/abc"
}
```

Gateway calls email service internally:

```http
POST /emails/chat-invite
X-Internal-Token: <internal-token>
Content-Type: application/json
```

```json
{
  "to": "friend@example.com",
  "inviteUrl": "https://app.example.com/invite/abc",
  "inviterName": "test@example.com"
}
```

`inviterName` is optional context derived from the authenticated JWT email when present. Gateway should not call `user-service` to hydrate the inviter profile in this phase.

### Gateway Files

Expected new files:

```text
services/gateway-service/src/validation/chat-invite.schema.ts
services/gateway-service/src/services/email-proxy.service.ts
services/gateway-service/src/controller/chat-invite.controller.ts
services/gateway-service/src/routes/chat-invite.route.ts
```

Expected changed files:

```text
services/gateway-service/src/config/env.ts
services/gateway-service/src/routes/index.ts
services/gateway-service/src/app.supertest.test.ts
```

### Gateway Validation

Validate:

- `email` is a valid email
- `inviteUrl` is an absolute `http` or `https` URL
- caller is authenticated

Gateway should not:

- check if the email exists in user-service
- create a conversation
- persist invite data

### Gateway Response

Success:

```http
200 OK
```

```json
{
  "data": {
    "sent": true
  }
}
```

## Phase 5: Frontend Wiring

### Target State

The private chat UI gets:

- email input
- send invite button
- loading state
- success state
- validation error state
- provider failure error state

Frontend calls:

```http
POST /chat-invites
```

```json
{
  "email": "friend@example.com",
  "inviteUrl": "<frontend-generated-invite-url>"
}
```

### Frontend Rules

- Do basic email validation before submit.
- Disable the button while the request is in flight.
- Show a clear success message only after gateway succeeds.
- Do not expose Resend details to the frontend.

## Phase 6: Documentation And Deployment

### Docs To Update

- `.env.example`
- `docs/openapi.yaml`
- `docs/repo-overview.md`
- deployment docs if Railway or Docker setup needs new variables

### New Environment Variables

Root `.env.example` should include:

```text
EMAIL_SERVICE_PORT=4004
EMAIL_SERVICE_URL=http://email-service:4004
RESEND_API_KEY=
EMAIL_FROM=
APP_NAME=Chat App
BRAND_PRIMARY_COLOR=#2563eb
BRAND_TEXT_COLOR=#111827
BRAND_MUTED_COLOR=#6b7280
```

Gateway environment:

```text
EMAIL_SERVICE_URL=http://email-service:4004
```

## Test Plan

### Email Service

- `GET /health` returns `200`.
- missing internal token returns `401`.
- invalid internal token returns `401`.
- invalid email returns `400`.
- invalid invite URL returns `400`.
- valid request calls Resend client.
- Resend failure maps to `502`.

### Gateway Service

- unauthenticated `POST /chat-invites` returns `401`.
- invalid email returns `422`.
- invalid invite URL returns `422`.
- valid request calls email service with internal token.
- email service failure is mapped to a useful gateway error.

### Docker Compose

- `email-service` builds successfully.
- `email-service` healthcheck passes.
- `gateway-service` can reach `http://email-service:4004`.

## Acceptance Criteria

- A logged-in user can submit an email and invite URL through gateway.
- Gateway forwards the invite request to email-service.
- Email-service sends the invite through Resend.
- No invite data is stored.
- No user lookup happens before sending.
- No worker queue is used.
- Docker Compose can run the new service.
- Existing auth, user, chat, and gateway flows remain unaffected.

## Future Options

Add these only if the product needs them:

- durable queue with RabbitMQ
- retries and dead-lettering
- invite tracking table
- signed invite tokens
- rate limiting
- abuse prevention
- email templates with branding
- multiple email notification types
