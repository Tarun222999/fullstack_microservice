# Chapter 06: Grafana

## Goal

## What Is Grafana?

Grafana is an open-source visualization and exploration tool.

Grafana does not replace Prometheus, Loki, or Jaeger. It connects to them as data sources.

```text
Grafana -> Prometheus -> metrics
Grafana -> Loki -> logs
Grafana -> Jaeger -> traces
```

## Dashboards

A dashboard is a collection of panels.

Useful panels:

- Request rate.
- Error rate.
- Latency percentiles.
- CPU and memory usage.
- RabbitMQ message counts.
- Email send failures.
- Active chat sockets.

## Explore View

Grafana Explore is for investigation.

Examples:

- Query logs for `email-service`.
- Search for errors in the last 15 minutes.
- Open a trace from Jaeger.
- Compare metrics before and after a failure.

## Alerts

Grafana can create alerts based on queries.

Good beginner alerts:

- Gateway error rate is high.
- Service is down.
- p95 latency is high.
- Email send failure rate is high.
- RabbitMQ consumer failures increased.

Avoid alerting too early on noisy signals. Bad alerts train people to ignore alerts.

## First Dashboard For This Project

Start with a service overview dashboard:

- Request rate by service.
- Error rate by service.
- p95 latency by service.
- Memory usage by service.
- CPU usage by service.

Then add domain dashboards:

- Auth dashboard.
- Chat dashboard.
- Email dashboard.
- RabbitMQ dashboard.

## Checkpoint Questions

- What does Grafana do?
- What data sources would we connect?
- What is a dashboard?
- What is Explore useful for?
- What is one alert that would be useful for `email-service`?
