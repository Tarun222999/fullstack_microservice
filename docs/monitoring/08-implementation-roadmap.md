# Chapter 08: Implementation Roadmap

## Goal

Implement observability in this project gradually, with a clear learning checkpoint after each milestone.

This is intentionally not a one-shot plan. Each milestone should leave the project in a working state and teach one part of the stack.

Use [Chapter 09: Observability Exploration Lab](./09-exploration-lab.md) after each milestone. The implementation roadmap tells us what to build; the exploration lab tells us what to click, query, compare, and explain.

## Current Project Shape

Application services:

- `gateway-service`: Node.js, Express, public API gateway.
- `auth-service`: Node.js, Express, MySQL, RabbitMQ publisher.
- `user-service`: Node.js, Express, PostgreSQL, RabbitMQ consumer and publisher.
- `chat-service`: Node.js, Express, MongoDB, Redis, RabbitMQ, Socket.IO.
- `email-service`: Go HTTP service, sends email through Resend.

Supporting infrastructure already in Docker Compose:

- RabbitMQ.
- Redis.
- MongoDB.
- PostgreSQL.
- MySQL.

Observability infrastructure to add:

- OpenTelemetry Collector.
- Prometheus.
- Jaeger.
- Loki.
- Grafana.

## Guiding Principles

- Add infrastructure before application instrumentation.
- Start with one service before instrumenting all services.
- Prefer automatic instrumentation first.
- Add manual instrumentation only where it explains business flows.
- Keep logs and traces free of secrets.
- Validate each milestone before moving to the next one.
- Keep every step small enough to understand and debug.

## Target Architecture

```text
gateway-service  \
auth-service      \
user-service       -> OpenTelemetry Collector -> Jaeger
chat-service      /                           -> Prometheus
email-service    /

container logs -> Grafana Alloy -> Loki

Grafana -> Prometheus
Grafana -> Jaeger
Grafana -> Loki
```

## Milestone 0: Baseline The Current System

Purpose:

Before adding tools, confirm the existing app still starts and health checks work.

Expected changes:

- No code changes.

Commands to run:

```powershell
docker compose up --build
```

Windows Docker note:

If Docker fails while loading the build context with an error like this:

```text
failed to solve: changes out of order: "packages/common" "package.json"
```

rerun the build with BuildKit disabled:

```powershell
$env:DOCKER_BUILDKIT='0'
docker compose up --build
```

This happens before application code is compiled. It is a Docker build-context issue, not an application error.

Manual checks:

- `http://localhost:4000/health`
- `http://localhost:4001/health`
- `http://localhost:4002/health`
- `http://localhost:4003/health`
- `http://localhost:4004/health`

Done when:

- Existing services start.
- Health checks pass.
- We know any existing failures are unrelated to observability.

Learning checkpoint:

- Which services are running?
- Which ports do they expose?
- Which service is easiest to test first?

## Milestone 1: Add Observability Infrastructure Only

Purpose:

Run the tools without instrumenting application code yet.

Files likely touched:

- `docker-compose.yaml`
- `docs/monitoring/`
- `monitoring/otel-collector/config.yaml`
- `monitoring/prometheus/prometheus.yaml`
- `monitoring/loki/loki.yaml`
- `monitoring/grafana/provisioning/`

Services to add:

- `otel-collector`
- `prometheus`
- `jaeger`
- `loki`
- `grafana`

Suggested local ports:

- Grafana: `3000`
- Prometheus: `9090`
- Jaeger UI: `16686`
- OpenTelemetry Collector OTLP gRPC: `4317`
- OpenTelemetry Collector OTLP HTTP: `4318`
- Loki: `3100`

Done when:

- Grafana opens.
- Prometheus opens.
- Jaeger opens.
- Loki is reachable.
- The app services can still start.

Learning checkpoint:

- Which tool stores metrics?
- Which tool stores traces?
- Which tool stores logs?
- What role does Grafana play?

## Milestone 2: Instrument `gateway-service` For Traces

Purpose:

Make one Node service emit traces before touching the rest.

Why gateway first:

- It is the public entrypoint.
- It calls downstream services.
- It gives immediate visibility into route latency.

Files likely touched:

- `packages/common/src/telemetry.ts`
- `packages/common/src/index.ts`
- `services/gateway-service/src/tracing.ts`
- `services/gateway-service/src/index.ts` or a new bootstrap entrypoint
- `services/gateway-service/package.json`
- `services/gateway-service/Dockerfile`
- `docker-compose.yaml`

Expected behavior:

- Incoming HTTP requests create spans.
- Health route can be excluded from noisy tracing.
- Traces appear in Jaeger.
- Service name is `gateway-service`.

Done when:

- A request to the gateway creates a trace in Jaeger.
- The trace has a useful route/span name.
- Application behavior is unchanged.

Learning checkpoint:

- What is a span?
- What is a trace?
- What is `service.name`?
- Why must tracing initialize before Express is imported?

## Milestone 3: Add Metrics For `gateway-service`

Purpose:

Expose basic service metrics and have Prometheus scrape them through the collector.

Files likely touched:

- `packages/common/src/telemetry.ts`
- `monitoring/otel-collector/config.yaml`
- `monitoring/prometheus/prometheus.yaml`
- `docker-compose.yaml`

Expected metrics:

- Request count.
- Request duration.
- Error count or status code labels.
- Process/runtime metrics if available.

Done when:

- Prometheus shows gateway metrics.
- Grafana can query gateway request rate.
- We can produce a simple latency graph.

Learning checkpoint:

- What is a counter?
- What is a histogram?
- Why is latency usually measured with histograms?

## Milestone 4: Instrument Remaining Node Services

Purpose:

Expand tracing and metrics to the rest of the Node services.

Services:

- `auth-service`
- `user-service`
- `chat-service`

Files likely touched:

- `services/auth-service/src/tracing.ts`
- `services/user-service/src/tracing.ts`
- `services/chat-service/src/tracing.ts`
- Node service package files.
- Node service Dockerfiles.
- `docker-compose.yaml`

Expected behavior:

- HTTP spans appear for each service.
- Database spans begin appearing where supported.
- Redis and MongoDB spans appear for chat flows where supported.
- Gateway-to-service traces should connect through HTTP headers.

Done when:

- A request through gateway produces a multi-service trace.
- Jaeger shows at least two connected services in one trace.
- Prometheus receives basic metrics for each Node service.

Learning checkpoint:

- How does trace context move through HTTP?
- What is auto-instrumentation?
- Which spans came from our code and which came from libraries?

Implementation note:

- The same defensive bootstrap pattern used by `gateway-service` is now used by `auth-service`, `user-service`, and `chat-service`.
- Each service imports telemetry first from `src/index.ts`, then imports its real application startup from `src/main.ts`.
- If telemetry startup fails, the service logs the error and continues without telemetry.
- Each service sends OTLP HTTP telemetry to `http://otel-collector:4318`.
- Each service sets a unique `OTEL_SERVICE_NAME`, so Jaeger and Prometheus can separate the telemetry by service.

Verification commands:

```powershell
pnpm --filter @chatapp/common build
pnpm --filter user-service build
pnpm --filter chat-service build
pnpm --filter @chatapp/auth-service build
```

Current verification note:

- `user-service` and `chat-service` compile successfully.
- `auth-service` currently fails before telemetry is checked because its build includes test files that import `vitest`, and the active install cannot resolve those test types.
- Treat the auth build issue as a separate test/build-config cleanup unless it appears in Docker after a fresh install.

## Milestone 5: Instrument `email-service`

Purpose:

Add OpenTelemetry Go instrumentation to the email service.

Files likely touched:

- `services/email-service/go.mod`
- `services/email-service/main.go`
- `services/email-service/internal/server/server.go`
- `services/email-service/internal/email/resend.go`
- `services/email-service/internal/observability/`
- `services/email-service/Dockerfile`
- `docker-compose.yaml`

Expected behavior:

- `/emails/chat-invite` creates server spans.
- Resend API calls create outbound HTTP client spans.
- Service name is `email-service`.
- Metrics exist for request count, duration, and failures.

Done when:

- A gateway-to-email flow appears in Jaeger.
- Resend latency is visible as a child span when an email is attempted.
- Email service metrics are visible in Prometheus.

Learning checkpoint:

- How is Go instrumentation different from Node instrumentation?
- What is an outbound HTTP client span?
- Why should email addresses and API keys not be added as span attributes?

Implementation note:

- `email-service` now starts a Go OpenTelemetry tracer and meter provider during process startup.
- Inbound `POST /emails/chat-invite` requests are wrapped with `otelhttp`.
- Outbound Resend HTTP calls use an `otelhttp` transport, so provider latency can appear as a child span.
- `/health` remains uninstrumented to avoid noisy traces.
- Telemetry startup failure is non-fatal; the service continues without telemetry.
- Email addresses, invite URLs, and API keys are not added as custom span attributes.

Verification commands:

```powershell
cd services/email-service
$env:GOTELEMETRY='off'
go test ./...
go build ./...
```

## Milestone 6: Add Loki For Centralized Logs

Purpose:

Collect logs from services in one place.

Files likely touched:

- `docker-compose.yaml`
- `monitoring/loki/loki.yaml`
- `monitoring/alloy/config.alloy`
- `packages/common/src/logger.ts`
- `services/email-service/internal/observability/` or logging package

Expected behavior:

- Service logs are queryable in Grafana through Loki.
- Logs can be filtered by service/container.
- Error logs can be found without opening individual container output.

Done when:

- Grafana can query logs from at least `gateway-service` and `email-service`.
- Logs have useful fields or labels.
- Sensitive values are not present.

Learning checkpoint:

- What is a Loki label?
- Why should labels be low-cardinality?
- What should never be logged?

Implementation note:

- Grafana Alloy now runs locally as the log shipper.
- Alloy reads Docker container logs through `/var/run/docker.sock`.
- Alloy keeps logs for this Compose project and adds useful Loki labels:
  - `container`
  - `service`
  - `compose_project`
  - `source`
- Alloy pushes logs to Loki at `http://loki:3100/loki/api/v1/push`.
- Grafana already has a provisioned Loki datasource, so logs can be queried from Grafana Explore.

Local-only note:

- This Alloy setup is designed for local Docker Compose learning.
- Railway production may need a different log shipping approach because Railway does not expose Docker container logs through a local Docker socket.

Verification commands:

```powershell
docker compose up -d loki alloy grafana
docker compose logs --tail=100 alloy
```

Grafana Explore queries:

```logql
{compose_project="fullstack_microservice"}
```

```logql
{service="gateway-service"}
```

```logql
{service="gateway-service"} |= "error"
```

## Milestone 7: Add Trace And Log Correlation

Purpose:

Make it easy to jump from a trace to related logs and from logs to a trace.

Files likely touched:

- `packages/common/src/logger.ts`
- Node telemetry/logging helper files.
- Go email logging helper files.
- Grafana datasource configuration.

Expected behavior:

- Logs include `trace_id` and `span_id` when available.
- Error logs can be searched by trace id.
- Grafana can correlate logs and traces.

Done when:

- Trigger one failing request.
- Open the trace in Jaeger or Grafana.
- Find related logs using the trace id.

Learning checkpoint:

- Why are traces and logs separate signals?
- Why is correlation useful?
- Why is `trace_id` better in the log body than as a Loki label?

Implementation note:

- Node services now add `trace_id` and `span_id` to Pino logs automatically when a log happens inside an active OpenTelemetry span.
- The shared logger in `packages/common/src/logger.ts` reads the current OpenTelemetry context through `@opentelemetry/api`.
- Go `email-service` has a small request-context helper for extracting trace and span ids from `context.Context`.
- Request-scoped email-service error logs now include `trace_id` and `span_id`.
- Node services now emit one `http.request.completed` log per non-health HTTP request.
- These request-completion logs include `trace_id`, `span_id`, method, target, status code, and duration.
- We intentionally keep `trace_id` in the log body instead of promoting it to a Loki label to avoid high-cardinality labels.

Grafana Loki examples:

```logql
{service="gateway-service"} |= "trace_id"
```

```logql
{service="gateway-service"} |= "YOUR_TRACE_ID"
```

```logql
{service="email-service"} |= "trace_id"
```

## Milestone 8: Manual Instrumentation For Business Flows

Purpose:

Add custom spans and metrics where automatic instrumentation is not enough.

Places to instrument:

- Auth outbox publish.
- User RabbitMQ consumer.
- User outbox publish.
- Chat RabbitMQ consumer.
- Socket.IO message handling.
- Email send operation.

Expected behavior:

- Async flows are easier to follow.
- RabbitMQ publish and consume operations include useful context.
- Email provider failures are easy to identify.

Done when:

- Register-user flow is traceable across HTTP and RabbitMQ.
- Chat invite email flow clearly shows gateway, email-service, and provider call.
- Manual spans have useful names and safe attributes.

Learning checkpoint:

- When is auto-instrumentation enough?
- When should we add manual spans?
- What attributes are safe and useful?

## Milestone 9: Grafana Dashboards

Purpose:

Turn raw telemetry into useful views.

Dashboards to create:

- Service overview.
- Gateway dashboard.
- Email service dashboard.
- RabbitMQ dashboard.
- Chat service dashboard.

Useful panels:

- Request rate.
- Error rate.
- p95 latency.
- Service CPU/memory.
- Email send failures.
- RabbitMQ consumer failures.
- Socket.IO connection count.

Done when:

- Grafana has at least one service overview dashboard.
- The dashboard can answer "is something wrong?"
- A trace/log workflow can answer "why is it wrong?"

Learning checkpoint:

- Which panels are useful every day?
- Which panels are noise?
- What alert would be worth waking someone up for?

## Milestone 10: Alerts And Production Readiness

Purpose:

Define a minimal alerting strategy and avoid noisy alerts.

Possible alerts:

- Service down.
- Gateway p95 latency too high.
- Gateway 5xx error rate too high.
- Email send failure rate too high.
- RabbitMQ consumer failures increasing.
- Database connection failures.

Production topics:

- Retention.
- Sampling.
- Resource limits.
- Dashboard provisioning.
- Secret scrubbing.
- Cost of storage.
- Railway or cloud deployment differences.

Done when:

- We have a small set of meaningful alerts.
- Each alert has an owner action.
- Telemetry does not expose secrets.

Learning checkpoint:

- What makes an alert actionable?
- What should be a dashboard but not an alert?
- How long should logs, metrics, and traces be retained?

## First Implementation Slice

The first real code session should implement Milestone 1 only:

```text
Add local observability infrastructure to Docker Compose.
Do not instrument application code yet.
```

Why:

- It teaches the shape of the tools.
- It gives us a place to send telemetry later.
- It keeps failures easier to debug.

Expected output of the first slice:

- `docker-compose.yaml` has observability services.
- `monitoring/` contains config files.
- Grafana, Prometheus, Jaeger, and Loki can start.
- Existing app services still start.
