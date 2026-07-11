# Chapter 05: OpenTelemetry

## Goal

Understand OpenTelemetry as the standard way to collect telemetry without locking the project to one vendor.

## What Is OpenTelemetry?

OpenTelemetry is an open-source observability framework.

It provides:

- APIs for creating telemetry.
- SDKs for collecting telemetry.
- Auto-instrumentation for common libraries.
- Exporters for sending telemetry somewhere else.
- The OpenTelemetry Collector for receiving, processing, and forwarding telemetry.

## Why OpenTelemetry Exists

Without OpenTelemetry, every vendor would have its own custom agent and code API.

OpenTelemetry gives us a common model:

```text
application -> OpenTelemetry -> backend
```

The backend can be Jaeger, Prometheus, Grafana Cloud, Datadog, New Relic, Honeycomb, or something else.

## The Collector

The OpenTelemetry Collector is a separate service that receives telemetry and exports it to one or more destinations.

In this project, the collector can sit between our services and the tools:

```text
services -> otel-collector -> jaeger
services -> otel-collector -> prometheus
services -> logs/agent -> loki
```

## Auto-Instrumentation

Auto-instrumentation means OpenTelemetry can create spans and metrics for common libraries without us manually wrapping every function.

Useful Node auto-instrumentation:

- HTTP.
- Express.
- Axios through HTTP instrumentation.
- MySQL.
- PostgreSQL.
- MongoDB.
- Redis.
- RabbitMQ through `amqplib`.

Useful Go instrumentation for `email-service`:

- HTTP server instrumentation.
- HTTP client instrumentation for Resend API calls.

## Manual Instrumentation

Manual instrumentation means we add spans or metrics ourselves around important business logic.

Good places for manual instrumentation in this project:

- Auth outbox publishing.
- User event consuming.
- Chat event consuming.
- Email send operation.
- Socket.IO message handling.

## Resource Attributes

Resource attributes describe the service emitting telemetry.

Important fields:

- `service.name`
- `service.version`
- `deployment.environment`

Example service names:

- `gateway-service`
- `auth-service`
- `user-service`
- `chat-service`
- `email-service`

## Sampling

Sampling controls how many traces are kept.

For local learning, keep all traces.

For production, keeping every trace can become expensive. A common approach is:

- Keep all error traces.
- Keep a sample of successful traces.
- Keep more traces for important flows.

## Safety Rules

Never send secrets into telemetry.

Avoid recording:

- Passwords.
- JWTs.
- Refresh tokens.
- Internal API token.
- Resend API key.
- Full email addresses unless explicitly needed and allowed.

## Checkpoint Questions

- What problem does OpenTelemetry solve?
- What does the collector do?
- What is auto-instrumentation?
- When would we use manual instrumentation?
- Why are resource attributes important?
