import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

type NodeTelemetryOptions = {
  serviceName: string;
};

let sdk: NodeSDK | undefined;

const isTelemetryEnabled = () => (process.env.OTEL_ENABLED ?? '').toLowerCase() === 'true';

const tracesUrl = () => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  return `${endpoint.replace(/\/$/, '')}/v1/traces`;
};

const metricsUrl = () => {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  return `${endpoint.replace(/\/$/, '')}/v1/metrics`;
};

export const startNodeTelemetry = ({ serviceName }: NodeTelemetryOptions) => {
  if (!isTelemetryEnabled() || sdk) {
    return sdk;
  }

  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? serviceName,
      }),
      traceExporter: new OTLPTraceExporter({
        url: tracesUrl(),
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: metricsUrl(),
        }),
        exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 5000),
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': {
            ignoreIncomingRequestHook: (request) => request.url === '/health',
          },
        }),
      ],
    });

    sdk.start();
    return sdk;
  } catch (error) {
    sdk = undefined;
    console.error('Failed to start OpenTelemetry; continuing without telemetry', error);
    return undefined;
  }
};

export const shutdownNodeTelemetry = async () => {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
  } catch (error) {
    console.error('Failed to shut down OpenTelemetry cleanly', error);
  } finally {
    sdk = undefined;
  }
};
