# Railway Observability Plan

## Status

This document is the agreed implementation plan. Phase 1 is complete: application services no
longer depend on the collector in Docker Compose, and Go telemetry defaults to disabled with
focused tests. Phase 2 repository changes are implemented: the four pinned Railway images and
Railway-specific Collector, Prometheus, and Grafana configuration are present. Their Docker image
builds have been verified locally, along with the packaged Collector and Prometheus configuration.
Railway resources and deployment automation from Phase 3 onward have not been implemented.

## Decisions

- Deploy a moderate, self-hosted observability stack on Railway.
- Use Jaeger for traces. Tempo is intentionally out of scope.
- Use Prometheus for metrics.
- Use Grafana for dashboards and trace exploration.
- Use one OpenTelemetry Collector as the application telemetry entry point.
- Keep production application logs in Railway Log Explorer.
- Keep Loki and Grafana Alloy as local-development and learning tools only.
- Treat Jaeger trace storage as temporary. Traces may disappear after a Jaeger restart or
  redeployment.
- Make the complete observability stack optional. Turning it off must not stop or degrade
  normal application functionality.

## Target architecture

```text
gateway-service --\
auth-service -----\
user-service ------+-- OTLP/HTTP --> OpenTelemetry Collector
chat-service -----/                         |
email-service ----/                         +-- metrics --> Prometheus --\
                                             |                           |
                                             +-- traces ---> Jaeger -----+
                                                                       v
                                                                    Grafana

Application stdout/stderr --------------------------> Railway Log Explorer
```

The applications push telemetry only to the collector. They do not connect directly to
Prometheus, Jaeger, or Grafana.

## Railway services

Four optional services will be added to the existing Railway project:

| Service          | Purpose                                            | Public access | Persistent volume  |
| ---------------- | -------------------------------------------------- | ------------- | ------------------ |
| `otel-collector` | Receive, batch, and route application telemetry    | No            | None               |
| `prometheus`     | Scrape and retain metrics exposed by the collector | No            | `/prometheus`      |
| `jaeger`         | Receive and query distributed traces               | No            | None               |
| `grafana`        | Display metrics dashboards and query Jaeger traces | Yes           | `/var/lib/grafana` |

Only Grafana receives a public Railway domain. The collector, Prometheus, and Jaeger stay
on Railway private networking.

## Planned repository changes

### 1. Package each Railway service

Add Railway-ready Dockerfiles:

```text
monitoring/otel-collector/Dockerfile
monitoring/prometheus/Dockerfile
monitoring/jaeger/Dockerfile
monitoring/grafana/Dockerfile
```

Each image will pin a specific upstream version rather than using `latest`. The Dockerfiles
will copy the required configuration and provisioning files into their images because
Railway cannot use the local bind mounts from `docker-compose.yaml`.

### 2. Add Railway-specific configuration

The local configuration uses Docker Compose service names such as `jaeger` and
`otel-collector`. Railway configuration must use private DNS names:

```text
otel-collector.railway.internal
prometheus.railway.internal
jaeger.railway.internal
grafana.railway.internal
```

Planned configuration work:

- Let the collector read its Jaeger OTLP endpoint from an environment variable.
- Add the collector health extension on port `13133`.
- Add a Prometheus Railway configuration that scrapes
  `otel-collector.railway.internal:9464`.
- Add Grafana Railway provisioning with Prometheus and Jaeger data sources.
- Do not provision a Loki data source in Railway Grafana.
- Exclude Loki-only panels from Railway dashboards so expected log panels do not appear as
  broken panels.
- Bind private listeners to IPv6/dual-stack addresses where supported so the services work
  in both new and legacy Railway environments.

The existing local Loki, Alloy, and Grafana configuration will remain available for local
learning.

### 3. Remove hard application dependencies on observability

The current Docker Compose application services declare `otel-collector` in
`depends_on`. Those dependencies will be removed.

The intended dependency direction is:

```text
application -> optional telemetry export
```

It must never become:

```text
application startup -> collector availability
```

No application health endpoint will check the collector, Prometheus, Jaeger, or Grafana.

### 4. Make telemetry opt-in consistently

All application services will use the same behavior:

- `OTEL_ENABLED=true` starts telemetry.
- `OTEL_ENABLED=false` skips telemetry initialization.
- An absent `OTEL_ENABLED` value defaults to disabled in production code.
- Telemetry initialization errors are logged and application startup continues.
- Runtime export failures occur in the background and do not fail business requests.

The Node services already default to disabled and catch initialization errors. The Go email
service currently defaults to enabled, so it will be changed to default to disabled for
consistent fail-open behavior. Docker Compose can continue to set `OTEL_ENABLED=true`
explicitly for the full local learning stack.

### 5. Extend deployment automation separately

The CD workflow will gain these deployment choices:

```text
observability
otel-collector
prometheus
jaeger
grafana
```

The `observability` scope will deploy in this order:

1. `jaeger`
2. `otel-collector`
3. `prometheus`
4. `grafana`

The existing `all` scope will continue to deploy only application services. A normal
application deployment will therefore not require the observability services to be
healthy or deployed.

## Planned Railway configuration

### Application services

Set these variables on `gateway-service`, `auth-service`, `user-service`, `chat-service`,
and `email-service`:

```dotenv
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.railway.internal:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=production,service.namespace=chatapp
OTEL_METRIC_EXPORT_INTERVAL_MS=60000
```

Do not assign one shared `OTEL_SERVICE_NAME`. The code already provides a distinct name for
each service.

### OpenTelemetry Collector

```dotenv
PORT=13133
JAEGER_OTLP_ENDPOINT=jaeger.railway.internal:4317
```

- Health-check path: `/`
- OTLP/HTTP ingest: port `4318`
- OTLP/gRPC ingest: port `4317`
- Prometheus metrics endpoint: port `9464`
- Public domain: none
- Volume: none

### Prometheus

```dotenv
PORT=9090
```

- Health-check path: `/-/ready`
- Public domain: none
- Volume mount: `/prometheus`
- Initial retention target: seven days
- Initial replica count: one

### Jaeger

```dotenv
PORT=16686
COLLECTOR_OTLP_ENABLED=true
```

- Health-check path: `/` initially, verified during the first deployment
- OTLP/gRPC ingest: port `4317`
- Query/UI API: port `16686`
- Public domain: none
- Volume: none
- Storage: in memory
- Initial replica count: one

Jaeger is deliberately ephemeral for this learning application. A restart can remove old
traces, but it cannot affect application data or application availability.

### Grafana

```dotenv
PORT=3000
RAILWAY_RUN_UID=0
GF_SECURITY_ADMIN_USER=<admin-user>
GF_SECURITY_ADMIN_PASSWORD=<strong-random-password>
GF_USERS_ALLOW_SIGN_UP=false
GF_SERVER_ROOT_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
PROMETHEUS_URL=http://prometheus.railway.internal:9090
JAEGER_URL=http://jaeger.railway.internal:16686
```

- Health-check path: `/api/health`
- Public domain: yes
- Volume mount: `/var/lib/grafana`
- Initial replica count: one

The Grafana password must be stored only in Railway variables and must not be committed.

## Turning observability off

There are two supported cases.

### Planned maintenance or cost control

1. Set `OTEL_ENABLED=false` on all five application services.
2. Redeploy the application services.
3. Stop the Grafana, Prometheus, Jaeger, and collector services.

The app continues normally without exporter activity or retry noise.

### Unexpected observability outage

If any observability service stops unexpectedly while `OTEL_ENABLED=true`:

- Application services continue accepting requests.
- Application health checks remain healthy.
- Metrics or traces may be lost.
- Exporters may log connection errors and retry in the background.
- Railway application logs remain available.

If retry noise becomes undesirable, set `OTEL_ENABLED=false` and redeploy the application
services.

## Implementation phases

### Phase 1: Fail-open boundary

- Remove Compose collector dependencies from application services.
- Make the Go telemetry default disabled.
- Add or update tests for telemetry-disabled startup.
- Confirm each application starts with no collector running.

### Phase 2: Railway service images

- Add the four Dockerfiles.
- Add Railway-specific collector, Prometheus, and Grafana configuration.
- Validate every image locally.
- Confirm the local Compose stack still works.

### Phase 3: Railway deployment

- Create the four Railway services with the exact names in this document.
- Add volumes to Prometheus and Grafana.
- Apply variables and health checks.
- Deploy in the documented order.
- Expose Grafana only.

### Phase 4: Application connection

- Apply the shared OpenTelemetry variables to all five application services.
- Redeploy internal services first and the gateway last.
- Generate traffic through the gateway.
- Verify metrics and traces.

### Phase 5: Failure testing

- Stop Jaeger and confirm the application remains healthy.
- Stop Prometheus and confirm the application remains healthy.
- Stop the collector and confirm the application remains healthy.
- Set `OTEL_ENABLED=false`, redeploy, and confirm exporter errors stop.
- Re-enable the stack and confirm telemetry resumes.

## Verification checklist

### Repository checks

- Docker Compose configuration parses successfully.
- All four observability images build successfully.
- Collector configuration validates successfully.
- Prometheus configuration validates successfully.
- Grafana provisioning loads without missing data sources.
- Application builds and tests pass.
- Go tests pass.

### Railway checks

- All four observability health checks are green.
- Prometheus reports the `otel-collector` scrape target as up.
- Grafana reports both Prometheus and Jaeger data sources as healthy.
- Each application service appears separately in Prometheus metrics.
- A gateway request produces a trace containing downstream service spans.
- Railway Log Explorer continues to receive structured application logs.
- Only Gateway and Grafana have public domains.

### Independence checks

- Gateway `/health` remains successful with the collector stopped.
- Normal register, login, user, conversation, and email flows do not depend on Grafana.
- Application deployment succeeds while all four observability services are stopped.
- Observability services can be redeployed without redeploying the application.

## Known trade-offs

- Jaeger traces are not durable.
- Prometheus and Grafana volumes limit those services to one replica on Railway.
- Volume-backed services can have a short restart gap during deployment.
- Railway Grafana will not contain centralized application logs.
- The stack is suitable for learning and modest traffic, not high availability.
- Running four extra services increases Railway compute and storage cost.

## Future options, not part of this plan

- Add durable Jaeger storage if trace retention becomes important.
- Replace Jaeger with Tempo only if project requirements change.
- Send logs to Loki using application-level OTLP logging or a Railway-aware log forwarder.
- Add alert notification channels after useful thresholds are established.
- Add staging observability before production.

## Reference documentation

- [Railway private networking](https://docs.railway.com/private-networking)
- [Railway OpenTelemetry stack guide](https://docs.railway.com/guides/deploy-an-otel-collector-stack)
- [Railway volumes](https://docs.railway.com/volumes/reference)
- [Railway logs](https://docs.railway.com/observability/logs)
- [OpenTelemetry Collector configuration](https://opentelemetry.io/docs/collector/configuration/)
- [Jaeger deployment](https://www.jaegertracing.io/docs/latest/deployment/)
