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

## Websocket Integration Plan (Chat-Service First, Extensible Design)

### Summary
Implement websocket connectivity for users directly to `chat-service` with **persist-first delivery** and **core + presence** features in MVP, while designing event contracts and service boundaries so typing/read receipts can be added without re-architecture. Keep Gateway on HTTP for now; optionally add Gateway websocket proxy later.

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
- Remaining Phase 1 steps:
  - conversation join/leave
  - persist-first `message:send`
  - Redis adapter
  - final docs and regression validation

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
  - `conversation:{conversationId}` (next step)

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

### MVP Features (Supported) and Extension Path
- **MVP supported**
  - Socket auth (JWT-based user identity on connect)
  - User room join (`user:{userId}`)
  - Conversation room join (`conversation:{conversationId}`) with membership check
  - `message:send` (persist-first), `message:new` fanout
  - Sender ack/error events (`message:ack`, `message:error`)
  - Presence (`presence:online`, `presence:offline`) with Redis-backed online state
  - Reconnect sync hook (`messages:sync` by last message timestamp/id)
- **Extended features (planned next)**
  - Typing indicators (`typing:start`, `typing:stop`)
  - Read receipts (`conversation:read`)
  - Delivery/read state fanout optimization
  - Gateway websocket proxy mode (single public entrypoint)
  - Multi-device session policies and per-device presence

### System Design and Implementation Changes
- **Connection topology**
  - Frontend connects to `chat-service` websocket endpoint.
  - Keep Gateway as REST proxy only in MVP.
  - Add Redis adapter from day one for horizontal socket scaling.
- **Authentication and authorization**
  - Websocket handshake includes JWT.
  - Validate JWT in socket middleware; attach `socket.data.user`.
  - For room joins and `message:send`, verify conversation membership using existing conversation service/repository.
- **Event flow (persist-first)**
  - `socket.on("message:send")`:
    1. Validate payload
    2. Authorize sender membership
    3. Persist via existing `messageService.createMessage`
    4. Emit `message:new` to conversation participants/room
    5. Emit `message:ack` to sender
  - On failure, emit safe `message:error` (no internal stack details).
- **Presence design**
  - On connect/disconnect, maintain Redis keys/sets for user online sessions.
  - Broadcast online/offline only on first connect/last disconnect per user.
  - Include optional last-seen timestamp storage for offline state.
- **Scalability/reliability**
  - Use Socket.IO Redis adapter to route emits across instances.
  - Apply connection and message rate-limits.
  - Set heartbeat/ping intervals and backpressure-safe payload size limits.
  - Keep service events (RabbitMQ) and realtime socket delivery concerns separate.
- **Observability/security**
  - Structured logs with `userId`, `conversationId`, `socketId`, event type, latency.
  - Metrics: active sockets, send rate, ack/error counts, auth failures, fanout size.
  - JWT expiry handling + forced disconnect on invalid token.
  - CORS/origin allowlist for websocket origin policy.

### Interfaces / Contracts
- **Socket events (MVP)**
  - Client -> server: `conversation:join`, `conversation:leave`, `message:send`, `messages:sync`
  - Server -> client: `message:new`, `message:ack`, `message:error`, `presence:online`, `presence:offline`
- **Payload shape principles**
  - Include `conversationId`, `messageId`, `senderId`, `createdAt`, and client correlation id for ack mapping.
  - Keep schemas versionable (add optional fields only in MVP).
- **No HTTP contract changes** required for current REST endpoints.

### Test Plan and Acceptance Criteria
- **Unit tests**
  - Socket auth middleware success/failure
  - `message:send` handler: success, unauthorized membership, validation errors
  - Presence transitions (first connect / last disconnect semantics)
- **Integration tests**
  - Two users in same conversation receive `message:new`
  - Non-participant cannot join/send
  - Reconnect + `messages:sync` returns missed messages correctly
  - Multi-instance emit correctness with Redis adapter
- **Load/soak checks**
  - Connection churn and sustained messaging rate
  - Validate no duplicate emit on reconnect and correct ack latency
- **Acceptance criteria**
  - Persist-first guarantee respected (no `message:new` before DB write)
  - Presence accuracy under multi-instance deployment
  - Existing REST chat flows remain unaffected

### Assumptions and Defaults
- MVP uses **direct chat-service websocket endpoint**.
- Delivery semantic is **persist-first then emit**.
- Presence is included in MVP; typing/read receipts are deferred.
- Gateway websocket proxy is explicitly deferred to phase 2.
