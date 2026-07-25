import { shutdownNodeTelemetry, startNodeTelemetry } from '@chatapp/common';

startNodeTelemetry({ serviceName: 'gateway-service' });

export const shutdownGatewayTelemetry = shutdownNodeTelemetry;
