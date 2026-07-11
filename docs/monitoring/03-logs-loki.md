# Chapter 03: Logs And Loki

## Goal

Understand logs, structured logging, and how Loki fits into the stack.

## What Are Logs?

Logs are timestamped records emitted by applications.

Example:

```text
2026-07-04T12:00:00Z auth-service login failed for user
```

Logs are useful because they contain application-level details that metrics cannot hold.

## Unstructured Logs

Unstructured logs are plain text messages.

Example:

```text
failed to send chat invite email: provider request failed
```

They are easy to write but harder to search reliably.

## Structured Logs

Structured logs include fields.

Example:

```json
{
  "level": "error",
  "service": "email-service",
  "route": "/emails/chat-invite",
  "status": 502,
  "trace_id": "abc123",
  "message": "Email provider request failed"
}
```

Structured logs are better for filtering and correlation.

## What Is Loki?

Loki is an open-source log aggregation system from Grafana Labs.

It stores logs and lets Grafana query them.

Unlike some log systems, Loki focuses heavily on labels instead of indexing every word in every log line.

## Labels

Labels are fields used to group and find logs.

Good labels:

- `service`
- `environment`
- `level`
- `container`

Risky labels:

- `user_id`
- `request_id`
- `email`
- `trace_id`

High-cardinality labels can hurt performance. A high-cardinality label has too many unique values.

Use `trace_id` inside the log body, not usually as a Loki label.

## How Loki Fits This Project

Each service already logs today:

- Node services use Pino through `packages/common`.
- `email-service` currently uses Go `log`.

Later we can:

- Keep Pino for Node services.
- Make Go logs structured for `email-service`.
- Send container logs to Loki.
- Query logs in Grafana.
- Correlate logs with traces using `trace_id`.

## Useful Log Events For This Project

Good logs:

- Service startup and shutdown.
- Request failures.
- Auth failures without exposing secrets.
- RabbitMQ consumer failures.
- Outbox publish failures.
- Email provider failures.
- Database connection failures.

Avoid logging:

- Passwords.
- JWTs.
- Refresh tokens.
- Internal API tokens.
- Full request bodies with sensitive fields.
- Resend API keys.

## What Logs Are Not Good At

Logs are not ideal for high-level health dashboards.

They can tell us:

```text
email provider returned an error
```

They are less ideal for:

```text
Show p95 latency for the last 24 hours
```

That belongs in metrics.

## Checkpoint Questions

- What is the difference between structured and unstructured logs?
- What does Loki store?
- What is a Loki label?
- Why should secrets never be logged?
- Why should `trace_id` usually be in the log body instead of a label?
