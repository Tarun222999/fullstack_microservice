# Fullstack Microservice

## API Docs

- Swagger UI: `http://localhost:4000/docs`
- Raw OpenAPI spec: `http://localhost:4000/openapi.yaml`
- Gateway base URL for frontend REST calls: `http://localhost:4000`
- Socket.IO base URL for chat realtime: `http://localhost:4002`

## Deployment

- Each service now accepts the platform-provided `PORT` env var and will bind to it when present.
- Service-specific ports (`AUTH_SERVICE_PORT`, `USER_SERVICE_PORT`, `CHAT_SERVICE_PORT`, `GATEWAY__PORT`) remain supported as fallbacks for local/dev workflows.
- On Railway, no manual port remapping is required; just deploy and let Railway inject `PORT`.
