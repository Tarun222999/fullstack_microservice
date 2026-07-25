# Chapter 01: Foundations

## Goal

Understand what monitoring and observability mean, why they matter, and how they differ.

## The Problem

When an application runs locally, debugging is direct. You can read terminal output, add `console.log`, restart the process, and try again.

In a microservice system, that stops being enough. A single user action can touch several services, databases, queues, caches, and third-party APIs. When something fails, the hard question becomes:

```text
Where did the problem actually happen?
```

## Monitoring

Monitoring means collecting known signals from a system so we can detect known problems.

Examples:

- Is the service up?
- How many requests are failing?
- Is CPU usage high?
- Is memory growing?
- Is the database slow?

Monitoring is like a dashboard for expected questions.

## Observability

Observability means collecting enough useful signals that we can ask new questions about the system without changing the code every time.

Examples:

- Why did this specific request take 4 seconds?
- Which service returned the first error?
- Did RabbitMQ delay the flow?
- Did the email provider fail?
- Are failures linked to one endpoint, one user flow, or one deployment?

Observability is about investigation.

## The Three Main Signals

Most observability systems are built around three signals:

- `Metrics`: numeric measurements over time.
- `Logs`: timestamped records of things that happened.
- `Traces`: timelines of one request as it moves across services.

## How The Signals Answer Different Questions

Metrics answer:

- What is happening overall?
- Is the system healthy?
- Are errors increasing?
- Is latency getting worse?

Logs answer:

- What did the application say happened?
- What error message was produced?
- Which branch of logic ran?
- What useful context was attached?

Traces answer:

- What happened to this exact request?
- Which services were involved?
- Which step was slow?
- Which dependency failed?

## Important Vocabulary

- `Service`: one running application, such as `gateway-service`.
- `Telemetry`: data emitted by a system about its behavior.
- `Signal`: a category of telemetry, such as metrics, logs, or traces.
- `Latency`: how long something took.
- `Throughput`: how much work the system handled.
- `Error rate`: percentage or count of failed operations.
- `SLO`: service level objective, a reliability target.
- `Alert`: notification triggered when something needs attention.

## How This Applies To This Project

This project has multiple services. A single chat invite flow might touch:

```text
gateway-service -> chat-service -> email-service -> Resend API
```

Without observability, a user may report "invite email did not send" and we only know the symptom.

With observability, we can answer:

- Did the gateway receive the request?
- Did the gateway call `email-service`?
- Did `email-service` validate the request?
- Did Resend return an error?
- How long did each step take?
- What did each service log?

## Checkpoint Questions

Answer these before moving on:

- What is the difference between monitoring and observability?
  monitoring tells us when something is wrong by tracking known health signals
  Observability helps us understand why something is wrong by using metrics, logs, traces
- What are the three main telemetry signals?
  traces, logs, metrics
- Which signal is best for dashboards?
  metrics
- Which signal is best for debugging a specific request?
  trace
- Which signal is best for reading application error details?
  logs
