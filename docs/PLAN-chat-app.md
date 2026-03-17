## Open DM Phase 1

### Summary
Add open direct messaging as a first-class chat capability before websocket work.

- `POST /direct-conversations` starts a 1:1 chat with another user.
- The backend reuses the same direct conversation for the same user pair instead of creating duplicates.
- Existing `POST /conversations` remains the generic group-conversation API.
- Websockets, presence, unread state, blocking, and DM rate-limits are intentionally deferred.

### What Changed

#### Chat service
- Conversations now carry `kind: "direct" | "group"`.
- Direct conversations store an internal canonical pair key:
  - `minUserId:maxUserId`
- A unique Mongo index on that pair key prevents duplicate DMs for the same pair.
- New service flow:
  - `createConversation(...)` remains the group-conversation path
  - `createOrGetDirectConversation(requesterId, otherUserId)` is the new DM path

#### Gateway service
- New public API:
  - `POST /direct-conversations`
- Gateway validates:
  - caller is authenticated
  - `participantId` is a UUID
  - caller is not trying to DM themselves
  - target user exists in `user-service`
- After that, gateway proxies the request to `chat-service`

### Working Flow

#### 1. Start a direct chat
Client calls:

```http
POST /direct-conversations
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "participantId": "<other-user-id>"
}
```

#### 2. Gateway validates and resolves the target
Gateway:
- reads the caller from JWT
- rejects self-DM
- calls `user-service` to confirm the target user exists
- forwards the request to `chat-service`

#### 3. Chat service computes the canonical DM identity
Chat service:
- sorts the two user IDs
- builds `directPairKey = smallerUserId:largerUserId`

That key is the stable identity of the DM pair.

#### 4. Chat service creates or reuses the conversation
Chat service checks for an existing direct conversation by `directPairKey`.

- If one exists:
  - return it
- If none exists:
  - insert a new conversation with:
    - `kind = "direct"`
    - `title = null`
    - exactly two participants
    - `directPairKey`

If two requests race at the same time, the unique Mongo index ensures only one wins. The loser reads the already-created conversation and returns it.

#### 5. Client receives a normal conversation payload
Response shape is the same general conversation DTO, now with `kind`.

Example:

```json
{
  "data": {
    "id": "7af7345f-5419-47f1-b1a3-f25e31e0f1e4",
    "kind": "direct",
    "title": null,
    "participantIds": [
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222"
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "lastMessageAt": null,
    "lastMessagePreview": null
  }
}
```

### Why This Split Exists

#### `/conversations`
Use for generic conversations, especially groups.

- accepts `participantIds[]`
- can create multi-user chats
- treated as the group flow

#### `/direct-conversations`
Use for person-to-person chat.

- accepts one `participantId`
- caller is the second participant automatically
- always maps to exactly one direct conversation per pair

This keeps the UI simple:
- "New group" -> `/conversations`
- "Message this user" -> `/direct-conversations`

### Next Steps After Phase 1
- websocket join/send flow for live messaging
- presence
- unread/read state
- block user
- DM rate-limit / anti-spam

## Websocket Phase 1 Implementation

### Summary
Implement websocket connectivity for users directly to `chat-service` with a lean **persist-first realtime messaging** scope. Gateway stays HTTP-only. Phase 1 covers authenticated socket connections, per-user and per-conversation rooms, realtime message send/fanout, and Redis-backed room fanout across instances.

### Websocket Phase 1 Steps
- Step 1 completed:
  - Socket.IO is attached directly to the `chat-service` HTTP server.
  - Websocket lifecycle is started and stopped with the service.
  - Minimal socket connect/disconnect logging is in place.
- Step 2 completed:
  - socket handshake now requires a valid JWT
  - token is accepted from socket auth payload or `Authorization` header
  - authenticated user context is attached to the socket before handlers run
- Step 3 completed:
  - authenticated sockets now auto-join `user:{userId}`
  - connection logs include the user room name explicitly
- Step 4 completed:
  - sockets now support `conversation:join` and `conversation:leave`
  - only conversation participants are allowed to join `conversation:{conversationId}`
  - direct and group conversations both use the same room authorization rule
- Step 5 completed:
  - sockets now support `message:send`
  - messages are persisted through existing `messageService` before realtime emission
  - conversation participants receive `message:new`
  - sender receives ack/error feedback
- Step 6 completed:
  - Socket.IO now uses the Redis adapter for room fanout
  - websocket pub/sub uses dedicated Redis adapter clients
  - adapter clients are closed during websocket shutdown
- Step 7 completed:
  - docs now reflect only implemented websocket behavior
  - workspace regression suite is green

### Topology
- Websocket connections terminate at `chat-service`, not gateway.
- Gateway stays HTTP-only for this phase.

### Socket Auth Contract
- Client may send the access token through:
  - `socket.auth.token`
  - `Authorization: Bearer <token>` in handshake headers
- Invalid or missing tokens are rejected during the handshake.

### Room Naming
- Per-user room:
  - `user:{userId}`
- Conversation room:
  - `conversation:{conversationId}`

### What A Socket Means Here
- A socket is one active client connection to the Socket.IO server.
- Examples:
  - one browser tab = one socket
  - another browser tab = another socket
  - one mobile app session = another socket
- One user can have multiple sockets at the same time across tabs and devices.

### Why `user:{userId}` Exists
- After authentication, each socket joins `user:{userId}`.
- If the same user connects from another device or tab, that new socket also joins the same room.
- This gives the server one stable target for user-specific events.
- Emitting to `user:{userId}` sends the event to all active sockets for that user, which is how multi-device sync works.

### Conversation Room Join/Leave
- Client joins a conversation room by sending:
  - `conversation:join` with `{ conversationId }`
- Client leaves a conversation room by sending:
  - `conversation:leave` with `{ conversationId }`
- The server checks conversation membership before allowing the join.
- Only participants in that conversation can join `conversation:{conversationId}`.

### Realtime Message Flow
- Client sends:
  - `message:send` with `{ conversationId, body, clientMessageId? }`
- Server flow:
  - validate payload
  - call existing `messageService.createMessage(...)`
  - persist message
  - emit `message:new` to the conversation room
  - return ack to sender
- On failure:
  - sender receives `message:error`
  - sender also receives a negative ack payload

### Realtime Message Payloads
- Client -> server:
  - `message:send`
```json
{
  "conversationId": "7af7345f-5419-47f1-b1a3-f25e31e0f1e4",
  "body": "Hello there",
  "clientMessageId": "client-1"
}
```

- Server -> room:
  - `message:new`
```json
{
  "message": {
    "id": "11111111-2222-3333-4444-555555555555",
    "conversationId": "7af7345f-5419-47f1-b1a3-f25e31e0f1e4",
    "senderId": "dc40ca49-b0f2-4b27-a771-5fda47d1d66f",
    "body": "Hello there",
    "createdAt": "2026-01-01T00:01:00.000Z",
    "reactions": []
  }
}
```

- Server -> sender:
  - `message:ack`
```json
{
  "ok": true,
  "conversationId": "7af7345f-5419-47f1-b1a3-f25e31e0f1e4",
  "messageId": "11111111-2222-3333-4444-555555555555",
  "clientMessageId": "client-1"
}
```

- Server -> sender on failure:
  - `message:error`

### Redis Adapter
- Socket.IO room fanout is now backed by the Redis adapter.
- This keeps room delivery correct when `chat-service` runs in multiple instances.
- The websocket layer uses dedicated Redis pub/sub clients for adapter traffic instead of reusing the normal app Redis connection directly.

### Implemented Phase 1 Scope
- Socket auth (JWT-based user identity on connect)
- User room join (`user:{userId}`)
- Conversation room join/leave with membership checks
- Persist-first `message:send`
- `message:new` fanout
- Sender ack/error feedback
- Redis adapter for multi-instance room fanout

### Deferred To Phase 2+
- Presence
- Typing indicators
- Read receipts
- Unread counts
- Reconnect sync over websocket
- Rate limiting
- Payload size limits
- Heartbeat/ping hardening
- Gateway websocket proxy

### System Design
- **Connection topology**
  - Frontend connects directly to `chat-service` websocket endpoint.
  - Gateway remains REST-only.
- **Authentication and authorization**
  - JWT is validated during socket handshake.
  - Authenticated user is stored on `socket.data.user`.
  - Conversation room access is checked via existing conversation service logic.
- **Event flow**
  - `conversation:join` / `conversation:leave` manage membership in `conversation:{conversationId}` rooms.
  - `message:send` calls existing `messageService.createMessage(...)`.
  - Only after persistence succeeds does the server emit `message:new`.
- **Scaling**
  - Socket.IO Redis adapter propagates room fanout across multiple `chat-service` instances.

### Interfaces / Contracts
- **Socket events (MVP)**
  - Client -> server: `conversation:join`, `conversation:leave`, `message:send`
  - Server -> client: `message:new`, `message:ack`, `message:error`
- **Payload shape principles**
  - Include `conversationId`, `messageId`, `senderId`, `createdAt`, and client correlation id for ack mapping.
  - Keep schemas versionable (add optional fields only in MVP).
- **No HTTP contract changes** required for current REST endpoints.

### Test Plan and Acceptance Criteria
- **Unit tests**
  - Socket auth middleware success/failure
  - conversation join/leave authorization behavior
  - `message:send` handler: success and failure paths
- **Integration tests**
  - Direct and group conversations can both join/send through rooms
  - Non-participant cannot join/send
  - Redis adapter wiring is attached correctly
- **Acceptance criteria**
  - Persist-first guarantee is preserved
  - Existing REST chat flows remain unaffected
  - Workspace test suite remains green

### Final Phase 1 Status
- Websocket connections terminate at `chat-service`
- Delivery semantics are persist first, then emit
- Gateway websocket proxy is not part of this phase
- Presence and other realtime UX features remain deferred
