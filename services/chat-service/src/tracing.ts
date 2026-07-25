import { shutdownNodeTelemetry, startNodeTelemetry } from '@chatapp/common';

startNodeTelemetry({ serviceName: 'chat-service' });

export const shutdownChatTelemetry = shutdownNodeTelemetry;
