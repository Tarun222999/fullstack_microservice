# Fullstack Microservice

## Deployment

- Each service now accepts the platform-provided `PORT` env var and will bind to it when present.
- Service-specific ports (`AUTH_SERVICE_PORT`, `USER_SERVICE_PORT`, `CHAT_SERVICE_PORT`, `GATEWAY__PORT`) remain supported as fallbacks for local/dev workflows.
- On Railway, no manual port remapping is required; just deploy and let Railway inject `PORT`.
