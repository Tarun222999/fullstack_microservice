# Monitoring And Observability Curriculum

This curriculum is for learning monitoring and observability from zero, then applying it to this microservice project.

The goal is not to memorize tool names. The goal is to build a mental model for how production systems tell us what is happening, why something is slow, where failures begin, and what changed before users noticed.

## Project Context

This project currently has these services:

- `gateway-service`: public API gateway for frontend REST calls.
- `auth-service`: authentication service with MySQL and RabbitMQ publishing.
- `user-service`: user service with PostgreSQL and RabbitMQ consume/publish flows.
- `chat-service`: chat service with MongoDB, Redis, RabbitMQ, and Socket.IO.
- `email-service`: small Go service for chat invite emails through Resend.

The observability stack we want to learn and later integrate:

- `OpenTelemetry`: instrumentation and telemetry pipeline standard.
- `Prometheus`: metrics storage and query engine.
- `Jaeger`: distributed tracing UI and trace storage.
- `Loki`: centralized log storage.
- `Grafana`: dashboards and exploration UI for metrics, logs, and traces.

## Learning Path

Read these chapters in order:

1. [Chapter 01: Foundations](./01-foundations.md)
2. [Chapter 02: Metrics And Prometheus](./02-metrics-prometheus.md)
3. [Chapter 03: Logs And Loki](./03-logs-loki.md)
4. [Chapter 04: Traces And Jaeger](./04-traces-jaeger.md)
5. [Chapter 05: OpenTelemetry](./05-opentelemetry.md)
6. [Chapter 06: Grafana](./06-grafana.md)
7. [Chapter 07: Applying The Stack To This Project](./07-project-implementation-plan.md)
8. [Chapter 08: Implementation Roadmap](./08-implementation-roadmap.md)

## How To Study This

For each chapter:

1. Read the core idea.
2. Learn the vocabulary.
3. Connect the concept to this project.
4. Answer the checkpoint questions.
5. Only then move to implementation.

The best way to learn this stack is to follow one simple request through the system:

```text
frontend -> gateway-service -> auth/user/chat/email service -> database/queue/provider
```

Then ask:

- Did it succeed?
- How long did it take?
- Where did the time go?
- What logs were produced?
- Which service caused the failure?
- Did the same issue happen before?

That is observability in practical form.
