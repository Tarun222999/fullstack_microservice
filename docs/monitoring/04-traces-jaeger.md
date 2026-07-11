# Chapter 04: Traces And Jaeger

## Goal

Understand distributed tracing and how Jaeger helps debug one request across many services.

## What Is A Trace?

A trace is the full journey of one request or workflow.

Example:

```text
POST /auth/register
  gateway-service
    auth-service
      mysql
      rabbitmq publish
    user-service consumer
      postgres
```

The trace shows what happened and how long each step took.

## What Is A Span?

A span is one unit of work inside a trace.

Examples:

- HTTP request received by `gateway-service`.
- Axios call from gateway to `auth-service`.
- SQL query in `auth-service`.
- RabbitMQ publish.
- RabbitMQ consume in `user-service`.
- Email provider API call from `email-service`.

Each span has:

- Name.
- Start time.
- End time.
- Duration.
- Status.
- Attributes.
- Parent span, if it belongs under another span.

## Trace Context

Trace context is metadata passed between services so spans can be connected into one trace.

For HTTP, this usually travels in headers.

For RabbitMQ, this can travel in message headers.

If context is not propagated, traces become disconnected.

## What Is Jaeger?

Jaeger is an open-source distributed tracing system.

It lets us:

- Search traces.
- View a timeline of spans.
- See which service was slow.
- See where errors happened.
- Understand cross-service workflows.

## How Tracing Fits This Project

Useful traces:

- Register user flow.
- Login flow.
- Create conversation flow.
- Send message flow.
- Send chat invite email flow.
- RabbitMQ auth user registered flow.
- RabbitMQ user created flow.

Example email invite trace:

```text
POST /chat-invites
  gateway-service
    email-service POST /emails/chat-invite
      Resend API call
```

If Resend is slow, the trace should show that the external API span consumed most of the time.

## What Traces Are Not Good At

Traces are not the cheapest way to monitor everything.

They answer:

```text
What happened in this request?
```

They are less ideal for:

```text
How many total requests failed this week?
```

That belongs in metrics.

## Checkpoint Questions

- What is a trace?
- What is a span?
- Why does trace context need to move between services?
- Why is RabbitMQ tracing more complicated than HTTP tracing?
- Which project flow would you trace first?
