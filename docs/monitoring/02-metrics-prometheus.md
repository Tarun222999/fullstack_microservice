# Chapter 02: Metrics And Prometheus

## Goal

Understand metrics, why Prometheus exists, and what we would measure in this project.

## What Are Metrics?

Metrics are numbers recorded over time.

Examples:

- `http_requests_total`
- `http_request_duration_seconds`
- `process_cpu_seconds_total`
- `nodejs_heap_size_used_bytes`
- `rabbitmq_messages_ready`

Metrics are useful because they are cheap to store and easy to graph.

## Metric Types

Common metric types:

- `Counter`: a number that only goes up, such as total requests.
- `Gauge`: a number that can go up or down, such as memory usage.
- `Histogram`: buckets of measurements, usually used for latency.
- `Summary`: client-side calculated percentiles, less common in Prometheus setups.

## What Is Prometheus?

Prometheus is an open-source metrics database and query engine.

It usually works by scraping HTTP endpoints that expose metrics in Prometheus format.

Example:

```text
Prometheus -> scrape /metrics -> service or collector
```

In our setup, services can send metrics to the OpenTelemetry Collector, and Prometheus can scrape the collector.

## What Is PromQL?

PromQL is the query language for Prometheus.

Example ideas:

```promql
rate(http_server_request_duration_seconds_count[5m])
```

```promql
histogram_quantile(0.95, rate(http_server_request_duration_seconds_bucket[5m]))
```

You do not need to master PromQL at the start. First learn what you want to ask.

## Useful Metrics For This Project

Service-level metrics:

- Request count per service.
- Error count per service.
- Request latency per route.
- Service uptime.
- CPU and memory usage.

Gateway metrics:

- Requests by route.
- Downstream service latency.
- Downstream service failures.

Auth service metrics:

- Login attempts.
- Register attempts.
- Token refresh failures.
- MySQL query latency.
- Auth event publish failures.

User service metrics:

- PostgreSQL query latency.
- RabbitMQ consumer success/failure count.
- Outbox publish count.

Chat service metrics:

- MongoDB operation latency.
- Redis operation latency.
- Active Socket.IO connections.
- Message creation count.
- RabbitMQ consumer failures.

Email service metrics:

- Email send attempts.
- Email send successes.
- Email send failures.
- Resend API latency.

## What Metrics Are Not Good At

Metrics usually do not explain the full story of one request.

They can tell us:

```text
email-service error rate increased
```

They usually cannot tell us:

```text
This exact request failed because Resend returned 401
```

That is where logs and traces help.

## Checkpoint Questions

- What is a counter?
  that goes only up
- What is a gauge?
  can go down and up
- Why are histograms useful for latency?
  they group observations into latency buckets and support percentile estimates
- Why does Prometheus work well for dashboards?
- Which metrics would you want first for `email-service`?
