import { shutdownNodeTelemetry, startNodeTelemetry } from '@chatapp/common';

startNodeTelemetry({ serviceName: 'user-service' });

export const shutdownUserTelemetry = shutdownNodeTelemetry;
