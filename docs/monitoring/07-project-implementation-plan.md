# Chapter 07: Applying The Stack To This Project

## Goal

Turn the learning into a practical implementation plan for this repository.

## Target Local Stack

The local Docker Compose stack should eventually include:

- `otel-collector`
- `prometheus`
- `grafana`
- `jaeger`
- `loki`
- a log shipping path into Loki

Application services:

- `gateway-service`
- `auth-service`
- `user-service`
- `chat-service`
- `email-service`

## Proposed Architecture

```text
Node services -> OpenTelemetry JS -> otel-collector -> Jaeger
Node services -> OpenTelemetry JS -> otel-collector -> Prometheus

email-service -> OpenTelemetry Go -> otel-collector -> Jaeger
email-service -> OpenTelemetry Go -> otel-collector -> Prometheus

container logs -> Loki -> Grafana

Grafana -> Prometheus
Grafana -> Loki
Grafana -> Jaeger
```

## Phase 1: Run The Observability Tools

Add local infrastructure first:

- OpenTelemetry Collector.
- Prometheus.
- Grafana.
- Jaeger.
- Loki.

Expected result:

- Grafana UI opens locally.
- Prometheus UI opens locally.
- Jaeger UI opens locally.
- Loki is reachable.
- No application code is instrumented yet.

## Phase 2: Instrument One Node Service

Start with `gateway-service`.

Why:

- It receives most API traffic.
- It calls downstream services.
- It is the easiest place to see request latency and errors.

Expected result:

- HTTP request spans appear in Jaeger.
- Basic service metrics appear in Prometheus.
- Grafana can show gateway request rate and latency.

## Phase 3: Instrument All Node Services

Add OpenTelemetry JS setup to:

- `auth-service`
- `user-service`
- `chat-service`

Expected result:

- Gateway-to-service traces are connected.
- Database spans start appearing.
- RabbitMQ traces may appear, depending on instrumentation support and propagation.

## Phase 4: Instrument The Go Email Service

Add OpenTelemetry Go instrumentation to `email-service`.

Expected result:

- `/emails/chat-invite` requests produce traces.
- Outbound Resend API calls produce spans.
- Email send failures are visible in metrics and logs.

## Phase 5: Add Log Correlation

Improve logs so they can be connected to traces.

Node services:

- Keep Pino.
- Add `trace_id` and `span_id` when a trace is active.

Go email service:

- Move toward structured logs.
- Include route, status, duration, and trace context.

Expected result:

- From a trace, we can search related logs.
- From an error log, we can find the related trace.

## Phase 6: Add Focused Manual Instrumentation

Add custom spans and metrics around business-critical operations:

- Auth outbox publish.
- User event consume.
- Chat event consume.
- Socket.IO message handling.
- Email send operation.

Expected result:

- Traces explain important async and business flows.
- Metrics show failures in queues and email delivery.

## Phase 7: Build Grafana Dashboards

Start with:

- Service overview dashboard.
- Gateway dashboard.
- Email service dashboard.
- RabbitMQ dashboard.

Expected result:

- We can see service health at a glance.
- We can investigate failures from dashboard to trace to logs.

## Recommended First Flow To Observe

Start with the chat invite email flow:

```text
gateway-service -> email-service -> Resend API
```

Why this flow is good for learning:

- It crosses service boundaries.
- It has an external provider.
- It is small enough to understand.
- Failures are easy to simulate.

## Success Criteria

The implementation is successful when we can answer:

- Is each service up?
- What is the error rate per service?
- What is p95 latency per service?
- Can we view one request across services?
- Can we search logs by service and level?
- Can we connect an error log to a trace?
- Can we see email provider latency and failures?

## Checkpoint Questions

- Why should we start with tools before code instrumentation?
- Why is `gateway-service` a good first Node service?
- Why is `email-service` a good learning flow?
- What is log correlation?
- What does "done" mean for the first observability milestone?
