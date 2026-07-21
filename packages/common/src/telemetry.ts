import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import {
  context,
  propagation,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from '@opentelemetry/api';

type NodeTelemetryOptions = {
  serviceName: string;
};

let sdk: NodeSDK | undefined;

export type TraceCarrier = Record<string, string>;

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

export const captureTraceCarrier = (): TraceCarrier => {
  try {
    const carrier: TraceCarrier = {};
    propagation.inject(context.active(), carrier);
    return carrier;
  } catch {
    return {};
  }
};

export const contextFromTraceCarrier = (carrier?: Record<string, unknown>) => {
  if (!carrier) {
    return context.active();
  }

  try {
    const textCarrier = Object.entries(carrier).reduce<TraceCarrier>((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
        return acc;
      }

      if (value instanceof Uint8Array) {
        acc[key] = new TextDecoder().decode(value);
        return acc;
      }

      if (typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = String(value);
      }

      return acc;
    }, {});

    return propagation.extract(context.active(), textCarrier);
  } catch {
    return context.active();
  }
};

export const runWithBusinessSpan = async <T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T> | T,
): Promise<T> => {
  const tracer = trace.getTracer('chatapp-business-flows');

  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      recordBusinessSpanError(span, error);
      throw error;
    } finally {
      span.end();
    }
  });
};

export const runWithBusinessSpanFromCarrier = async <T>(
  carrier: Record<string, unknown> | undefined,
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T> | T,
): Promise<T> => {
  return context.with(contextFromTraceCarrier(carrier), () =>
    runWithBusinessSpan(name, attributes, fn),
  );
};

export const recordBusinessSpanError = (span: Span, error: unknown) => {
  span.recordException(error as Error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });
};
