import { shutdownNodeTelemetry, startNodeTelemetry } from '@chatapp/common';

startNodeTelemetry({ serviceName: 'auth-service' });

export const shutdownAuthTelemetry = shutdownNodeTelemetry;
