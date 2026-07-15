# Chapter 09: Observability Exploration Lab

## Goal

Use the finished stack as a hands-on lab.

Implementation teaches how the pieces are wired. Exploration teaches how to think with the tools when something is slow, broken, noisy, or unclear.

Use this chapter after each milestone. Do not wait until everything is perfect. The stack becomes easier to understand when you explore it while it is growing.

## Lab Setup

Start the project:

```powershell
$env:DOCKER_BUILDKIT='0'
docker compose up --build
```

Open the tools:

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000`
- Jaeger: `http://localhost:16686`
- OTel Collector OTLP HTTP: `http://localhost:4318`
- OTel Collector Prometheus metrics: `http://localhost:9464/metrics`

Grafana login:

- Username: `admin`
- Password: `admin`

Generate real traffic before exploring:

- Use the frontend.
- Call login/register routes.
- Open conversations.
- Send messages.

Avoid using only health checks because we intentionally ignore `/health` in telemetry to reduce noise.

## Mental Model

The local flow is:

```text
Node services -> OpenTelemetry SDK -> OTel Collector

OTel Collector -> Jaeger for traces
OTel Collector -> /metrics endpoint for Prometheus
Prometheus -> Grafana for dashboards and exploration

container logs -> Grafana Alloy -> Loki
Grafana -> Loki
```

Important labels in this project:

- `job`: the Prometheus scrape job. For app metrics, this is often `otel-collector`.
- `instance`: the exact scraped endpoint, such as `otel-collector:9464`.
- `exported_job`: the original OpenTelemetry service name, such as `gateway-service`.
- `http_method`: request method, such as `GET` or `POST`.
- `http_status_code`: response status, such as `200`, `401`, or `500`.
- `le`: histogram bucket boundary.
- `service`: Loki label for the Docker Compose service name, such as `gateway-service`.
- `container`: Loki label for the Docker container name, such as `chatapp-gateway-service`.
- `compose_project`: Loki label for the Compose project, usually `fullstack_microservice`.

## Lab 1: Prometheus Targets

Purpose:

Confirm Prometheus is collecting metrics from the expected places.

Steps:

1. Open `http://localhost:9090`.
2. Go to `Status -> Target health`.
3. Confirm these targets are `UP`:

```text
prometheus:9090
otel-collector:9464
```

Questions:

- What does `UP` mean?
- What would it mean if `otel-collector:9464` was down?
- Why does Prometheus scrape the collector instead of scraping every Node service directly?

## Lab 2: Request Volume

Purpose:

Understand counters and request rate.

Run in Prometheus or Grafana Explore:

```promql
http_server_duration_milliseconds_count
```

Then:

```promql
rate(http_server_duration_milliseconds_count[5m])
```

Then:

```promql
sum by (exported_job, http_method, http_status_code) (
  rate(http_server_duration_milliseconds_count[5m])
)
```

Questions:

- Which services are receiving HTTP requests?
- Which status codes are common?
- Why is `rate()` more useful than a raw counter for dashboards?

Expected learning:

- A counter keeps growing.
- `rate()` turns a growing counter into "per second" activity.
- Grouping by labels turns raw metrics into useful answers.

## Lab 3: Latency And Histograms

Purpose:

Understand p95 latency.

Run:

```promql
histogram_quantile(
  0.95,
  sum by (exported_job, le) (
    rate(http_server_duration_milliseconds_bucket[5m])
  )
)
```

Route/status breakdown:

```promql
histogram_quantile(
  0.95,
  sum by (exported_job, http_method, http_status_code, le) (
    rate(http_server_duration_milliseconds_bucket[5m])
  )
)
```

Questions:

- Which service has the highest p95 latency?
- Does latency change after you use the app?
- Why is p95 better than average latency for user experience?

Expected learning:

- Histograms store observations in buckets.
- `histogram_quantile()` estimates percentiles from those buckets.
- p95 means 95 percent of requests were faster than this value.

## Lab 4: Outbound Calls

Purpose:

See which service calls another service.

Run:

```promql
sum by (exported_job, net_peer_name, http_method, http_status_code) (
  rate(http_client_duration_milliseconds_count[5m])
)
```

Questions:

- Which downstream services does `gateway-service` call?
- Do you see calls to `auth-service`, `user-service`, or `chat-service`?
- What is the difference between `http_server_*` and `http_client_*` metrics?

Expected learning:

- Server metrics describe requests received by a service.
- Client metrics describe requests made by a service.
- Gateway should usually have both server and client metrics.

## Lab 5: Runtime Memory

Purpose:

Explore basic Node.js runtime metrics.

Run:

```promql
v8js_memory_heap_used_bytes{job="otel-collector"}
```

Then:

```promql
sum by (exported_job) (
  v8js_memory_heap_used_bytes{job="otel-collector"}
)
```

Questions:

- Which service uses the most Node heap memory?
- Does memory change after traffic?
- Why is heap memory not the same as total container memory?

Expected learning:

- App runtime metrics come from OpenTelemetry runtime instrumentation.
- Container memory requires a separate exporter such as cAdvisor.
- Database memory requires database-specific exporters.

## Lab 6: Jaeger Search

Purpose:

Learn how to identify which API request a trace represents.

Steps:

1. Open `http://localhost:16686`.
2. Search for `gateway-service`.
3. Pick a recent trace.
4. Click the root `gateway-service` span.
5. Look at span tags:

```text
http.method
http.target
http.url
http.status_code
```

Questions:

- Which exact API route created this trace?
- Which services participated in the trace?
- Which span took the most time?

Expected learning:

- A trace is the full request journey.
- A span is one operation inside that journey.
- The root gateway span usually tells you the original external API request.

## Lab 7: Multi-Service Trace

Purpose:

Follow a request across services.

Steps:

1. Open a gateway trace that includes `user-service` or `chat-service`.
2. Expand all spans.
3. Look for client spans from gateway.
4. Match them to server spans in downstream services.

Questions:

- Which gateway span called `user-service`?
- Which gateway span called `chat-service`?
- Did trace context connect the services into one trace?

Expected learning:

- Trace context moves through HTTP headers.
- Auto-instrumentation can create both client and server spans.
- A multi-service trace is more useful than separate per-service logs.

## Lab 8: Grafana Explore

Purpose:

Use Grafana as a single place to explore metrics and traces.

Steps:

1. Open `http://localhost:3000`.
2. Go to `Explore`.
3. Select `Prometheus`.
4. Run the PromQL queries from Labs 2-5.
5. Change the time range to `Last 5 minutes`, `Last 15 minutes`, and `Last 1 hour`.

Questions:

- How does changing the time range affect the graph?
- Which queries are useful as dashboard panels?
- Which queries are too noisy?

Expected learning:

- Prometheus is the metrics backend.
- Grafana is the exploration and visualization layer.
- Good dashboards start from useful Explore queries.

## Lab 9: First Service Health Dashboard

Purpose:

Decide what belongs on a dashboard.

Create or sketch panels for:

- Request rate by service.
- Error rate by service.
- p95 latency by service.
- Node heap memory by service.
- Outbound HTTP calls by service.

Starter queries:

```promql
sum by (exported_job) (
  rate(http_server_duration_milliseconds_count[5m])
)
```

```promql
sum by (exported_job, http_status_code) (
  rate(http_server_duration_milliseconds_count{http_status_code=~"5.."}[5m])
)
```

```promql
histogram_quantile(
  0.95,
  sum by (exported_job, le) (
    rate(http_server_duration_milliseconds_bucket[5m])
  )
)
```

```promql
sum by (exported_job) (
  v8js_memory_heap_used_bytes{job="otel-collector"}
)
```

Questions:

- Which panel tells you "is traffic normal?"
- Which panel tells you "are users seeing errors?"
- Which panel tells you "is the app slow?"
- Which panel tells you "is memory suspicious?"

Expected learning:

- Dashboards should answer a small set of operational questions.
- Not every metric deserves a dashboard panel.
- A good dashboard helps you decide where to investigate next.

## Lab 10: Alerts

Purpose:

Understand what should become an alert.

Candidate alert ideas:

- Gateway 5xx rate is greater than zero for 5 minutes.
- Gateway p95 latency is above 1000 ms for 5 minutes.
- No requests received for a service that should be active.
- A service target is down.

Questions:

- Which conditions are actionable?
- Which conditions are only dashboard-worthy?
- Who would respond to the alert?
- What would the first debugging step be?

Expected learning:

- Prometheus alert rules evaluate PromQL over time.
- Alertmanager sends notifications, but is not required to learn alert logic.
- Alerts should be rare, actionable, and tied to a response.

## Lab 11: Loki Logs

Purpose:

Explore centralized Docker container logs in Grafana.

Steps:

1. Open `http://localhost:3000`.
2. Go to `Explore`.
3. Select datasource `Loki`.
4. Run:

```logql
{compose_project="fullstack_microservice"}
```

Filter by service:

```logql
{service="gateway-service"}
```

Filter error-looking logs:

```logql
{service="gateway-service"} |= "error"
```

Filter auth logs:

```logql
{service="auth-service"}
```

Filter email service logs:

```logql
{service="email-service"}
```

Questions:

- Which service produced this log?
- What request or operation was happening?
- Can you find a related trace id?
- Is the log useful without opening the source code?

Expected learning:

- Loki stores logs.
- Grafana queries Loki with LogQL.
- Alloy is the local log shipper.
- Loki labels should identify broad streams such as service and container.
- Logs become much more powerful when they include `trace_id` and `span_id`.

## Lab 12: Trace And Log Correlation

Purpose:

Use a trace id from Jaeger to find related logs in Loki.

Steps:

1. Open `http://localhost:16686`.
2. Open a recent `gateway-service` trace.
3. Copy the trace id from the trace page URL or trace details.
4. Open Grafana Explore.
5. Select datasource `Loki`.
6. Search for that trace id:

```logql
{service="gateway-service"} |= "PASTE_TRACE_ID_HERE"
```

Search all app logs:

```logql
{service=~"gateway-service|auth-service|user-service|chat-service|email-service"} |= "PASTE_TRACE_ID_HERE"
```

Find logs that contain correlation fields:

```logql
{service=~"gateway-service|auth-service|user-service|chat-service|email-service"} |= "trace_id"
```

Questions:

- Which logs belong to the trace?
- Did the log line happen inside a request span?
- Is the trace id in the log body or a Loki label?
- Why would using trace ids as Loki labels be risky?

Expected learning:

- Traces tell you where a request went.
- Logs tell you what the application said during that request.
- Correlation lets you jump from "where did it fail?" to "what did the app log?"
- High-cardinality values like trace ids are better in log content than labels.

## Lab 13: Debugging Scenarios

Purpose:

Practice realistic investigation.

Scenario A: User says login is failing.

Use:

- Grafana or Prometheus error-rate query.
- Jaeger trace for the failed request.
- Auth service spans.
- Logs later through Loki.

Questions:

- Is the failure from gateway or auth-service?
- What status code is returned?
- Which span has the error?

Scenario B: Chat page is slow.

Use:

- p95 latency query.
- Gateway trace with chat-service spans.
- Outbound HTTP client metrics.

Questions:

- Is gateway slow or chat-service slow?
- Is the slow part an HTTP call, database call, or application handler?

Scenario C: Memory is increasing.

Use:

- Node heap memory query.
- Runtime metrics.
- Later cAdvisor container memory.

Questions:

- Which service memory is increasing?
- Is heap memory increasing or only container memory?
- Did traffic increase at the same time?

## Interview Practice

Use these answers after exploring:

- Prometheus stores and queries metrics.
- Grafana visualizes and explores metrics, logs, and traces.
- Jaeger stores and visualizes distributed traces.
- Loki stores and queries logs.
- OpenTelemetry instruments apps and exports telemetry.
- Metrics answer "what is happening over time?"
- Traces answer "what happened to this one request?"
- Logs answer "what exactly did the application say happened?"
- Dashboards answer "is the system healthy?"
- Alerts answer "does someone need to act now?"
