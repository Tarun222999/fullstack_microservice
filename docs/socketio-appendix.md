# Socket.IO Appendix

This repo uses Socket.IO for realtime chat in `chat-service`.

## Connection

- Socket server URL: `http://localhost:4002` in local development
- Authenticate with either:
  - `auth.token = <accessToken>` in the Socket.IO handshake, or
  - an `Authorization: Bearer <accessToken>` header

## Rooms

- Each connected user is automatically joined to `user:{userId}`
- Clients join conversation rooms through explicit events
- Conversation room format: `conversation:{conversationId}`

## Events

### `conversation:join`

Payload:

```json
{ "conversationId": "uuid" }
```

Ack success:

```json
{ "ok": true, "conversationId": "uuid" }
```

Ack failure:

```json
{ "ok": false, "error": "string" }
```

### `conversation:leave`

Payload:

```json
{ "conversationId": "uuid" }
```

Ack success:

```json
{ "ok": true, "conversationId": "uuid" }
```

Ack failure:

```json
{ "ok": false, "error": "string" }
```

### `message:send`

Payload:

```json
{
  "conversationId": "uuid",
  "body": "hello",
  "clientMessageId": "optional-client-id"
}
```

Ack success:

```json
{
  "ok": true,
  "conversationId": "uuid",
  "messageId": "uuid",
  "clientMessageId": "optional-client-id"
}
```

Ack failure:

```json
{
  "ok": false,
  "error": "string",
  "conversationId": "uuid",
  "clientMessageId": "optional-client-id"
}
```

### Emitted events

- `message:new`
  - emitted to the sender and other sockets in the conversation room
  - payload: `{ "message": { ...message } }`
- `message:error`
  - emitted when message send fails
  - payload: `{ "error": "string", "conversationId"?: "uuid", "clientMessageId"?: "string" }`

## Notes

- Socket events are not included in OpenAPI because OpenAPI models HTTP, not realtime websocket channels.
- Use this appendix alongside `docs/openapi.yaml` when wiring the frontend chat client.
