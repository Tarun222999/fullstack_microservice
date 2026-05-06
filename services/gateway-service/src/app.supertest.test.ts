import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const authProxyMocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  revoke: vi.fn(),
}));

const userProxyMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getAllUsers: vi.fn(),
  getUsersByIds: vi.fn(),
  getDmCandidates: vi.fn(),
  createUser: vi.fn(),
  searchUsers: vi.fn(),
}));

const chatProxyMocks = vi.hoisted(() => ({
  createConversation: vi.fn(),
  createDirectConversation: vi.fn(),
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  createMessage: vi.fn(),
  listMessages: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('@/services/auth-proxy.service', () => ({
  authProxyService: authProxyMocks,
}));

vi.mock('@/services/user-proxy.service', () => ({
  userProxyService: userProxyMocks,
}));

vi.mock('@/services/chat-proxy.service', () => ({
  chatProxyService: chatProxyMocks,
}));

vi.mock('@/utils/logger', () => ({
  logger: loggerMocks,
}));

import { createApp } from '@/app';

const makeAccessToken = (sub: string) =>
  jwt.sign({ sub, email: 'test@example.com' }, process.env.JWT_SECRET as string);

const allUsersResponse = {
  data: [
    {
      id: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      email: 'self@example.com',
      displayName: 'Self',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
      email: 'target@example.com',
      displayName: 'Target',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('gateway-service http', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /health returns service status', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'gateway-service',
    });
  });

  it('sets CORS headers for allowed origins only', async () => {
    const app = createApp();

    const allowedResponse = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173');
    const blockedResponse = await request(app)
      .get('/health')
      .set('Origin', 'https://unknown.example');

    expect(allowedResponse.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(blockedResponse.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('POST /auth/login returns 422 for invalid payload', async () => {
    const app = createApp();

    const response = await request(app).post('/auth/login').send({
      email: 'not-an-email',
      password: '123',
    });

    expect(response.status).toBe(422);
    expect(response.body.message).toBe('Validation Error');
  });

  it('POST /auth/login returns tokens for valid request', async () => {
    authProxyMocks.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    const app = createApp();

    const response = await request(app).post('/auth/login').send({
      email: 'valid@example.com',
      password: 'Password123!',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(authProxyMocks.login).toHaveBeenCalledWith({
      email: 'valid@example.com',
      password: 'Password123!',
    });
  });

  it('GET /users returns 401 when auth header is missing', async () => {
    const app = createApp();

    const response = await request(app).get('/users');

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Unauthorized');
  });

  it('GET /users returns data when token is valid', async () => {
    userProxyMocks.getAllUsers.mockResolvedValue({
      data: [
        {
          id: 'f9f7de98-a1bf-4e79-83af-f37075ef5bcf',
          email: 'one@example.com',
          displayName: 'One',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const app = createApp();
    const token = makeAccessToken('f9f7de98-a1bf-4e79-83af-f37075ef5bcf');

    const response = await request(app).get('/users').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(userProxyMocks.getAllUsers).toHaveBeenCalledTimes(1);
  });

  it('GET /users/dm-candidates returns all other users for the caller', async () => {
    userProxyMocks.getDmCandidates.mockResolvedValue({
      data: [
        {
          id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
          displayName: 'Target',
        },
      ],
    });
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get('/users/dm-candidates')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [
        {
          id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
          displayName: 'Target',
        },
      ],
    });
    expect(userProxyMocks.getDmCandidates).toHaveBeenCalledWith(
      'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
    );
  });

  it('POST /conversations returns 401 without auth header', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/conversations')
      .send({
        title: 'Project',
        participantIds: ['b77842d5-bd25-4d4d-bf5d-cc96853a6f13'],
      });

    expect(response.status).toBe(401);
  });

  it('POST /conversations appends caller id and delegates to chat proxy', async () => {
    userProxyMocks.getUsersByIds.mockResolvedValue({
      data: allUsersResponse.data,
    });
    chatProxyMocks.createConversation.mockResolvedValue({
      id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      kind: 'group',
      title: 'Project',
      participantIds: [
        'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
        '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastMessageAt: null,
      lastMessagePreview: null,
    });
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .post('/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Project',
        participantIds: ['936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
      });

    expect(response.status).toBe(201);
    expect(chatProxyMocks.createConversation).toHaveBeenCalledWith(
      'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      {
        title: 'Project',
        participantIds: [
          '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
          'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
        ],
      },
    );
    expect(response.body.data.participants).toEqual([
      { id: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f', displayName: 'Self' },
      { id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea', displayName: 'Target' },
    ]);
    expect(userProxyMocks.getUsersByIds).toHaveBeenCalledWith({
      ids: ['dc40ca49-b0f2-4b27-a771-5fda47d1d66f', '936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
    });
  });

  it('GET /conversations returns 403 when participantId is another user', async () => {
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get('/conversations?participantId=936cf6c1-be78-4192-9c77-8f44a84ff6ea')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(chatProxyMocks.listConversations).not.toHaveBeenCalled();
  });

  it('GET /conversations/:id returns 403 when caller is not a participant', async () => {
    chatProxyMocks.getConversation.mockResolvedValue({
      id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      kind: 'group',
      title: 'Project',
      participantIds: ['936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastMessageAt: null,
      lastMessagePreview: null,
    });
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get('/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('GET /conversations hydrates participants for chat rows', async () => {
    userProxyMocks.getUsersByIds.mockResolvedValue({
      data: allUsersResponse.data,
    });
    chatProxyMocks.listConversations.mockResolvedValue([
      {
        id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
        kind: 'direct',
        title: null,
        participantIds: [
          'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
          '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastMessageAt: '2026-01-01T00:02:00.000Z',
        lastMessagePreview: 'latest',
      },
    ]);
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get('/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data[0].participants).toEqual([
      { id: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f', displayName: 'Self' },
      { id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea', displayName: 'Target' },
    ]);
    expect(userProxyMocks.getUsersByIds).toHaveBeenCalledWith({
      ids: ['dc40ca49-b0f2-4b27-a771-5fda47d1d66f', '936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
    });
  });

  it('GET /conversations/:id hydrates participants for chat detail', async () => {
    userProxyMocks.getUsersByIds.mockResolvedValue({
      data: allUsersResponse.data,
    });
    chatProxyMocks.getConversation.mockResolvedValue({
      id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      kind: 'direct',
      title: null,
      participantIds: [
        'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
        '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastMessageAt: '2026-01-01T00:02:00.000Z',
      lastMessagePreview: 'latest',
    });
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get('/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.participants).toEqual([
      { id: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f', displayName: 'Self' },
      { id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea', displayName: 'Target' },
    ]);
    expect(userProxyMocks.getUsersByIds).toHaveBeenCalledWith({
      ids: ['dc40ca49-b0f2-4b27-a771-5fda47d1d66f', '936cf6c1-be78-4192-9c77-8f44a84ff6ea'],
    });
  });

  it('POST /direct-conversations returns 401 without auth header', async () => {
    const app = createApp();

    const response = await request(app).post('/direct-conversations').send({
      participantId: '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
    });

    expect(response.status).toBe(401);
  });

  it('POST /direct-conversations returns 422 for invalid body', async () => {
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .post('/direct-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ participantId: 'nope' });

    expect(response.status).toBe(422);
  });

  it('POST /direct-conversations rejects self DM', async () => {
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .post('/direct-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ participantId: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f' });

    expect(response.status).toBe(400);
    expect(chatProxyMocks.createDirectConversation).not.toHaveBeenCalled();
  });

  it('POST /direct-conversations validates target user and delegates to chat proxy', async () => {
    userProxyMocks.getUserById.mockResolvedValue({
      data: {
        id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
        email: 'target@example.com',
        displayName: 'Target',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    chatProxyMocks.createDirectConversation.mockResolvedValue({
      id: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      kind: 'direct',
      title: null,
      participantIds: [
        '936cf6c1-be78-4192-9c77-8f44a84ff6ea',
        'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastMessageAt: null,
      lastMessagePreview: null,
    });
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .post('/direct-conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ participantId: '936cf6c1-be78-4192-9c77-8f44a84ff6ea' });

    expect(response.status).toBe(200);
    expect(userProxyMocks.getUserById).toHaveBeenCalledWith('936cf6c1-be78-4192-9c77-8f44a84ff6ea');
    expect(chatProxyMocks.createDirectConversation).toHaveBeenCalledWith(
      'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      { participantId: '936cf6c1-be78-4192-9c77-8f44a84ff6ea' },
    );
    expect(response.body.data.participants).toEqual([
      { id: '936cf6c1-be78-4192-9c77-8f44a84ff6ea', displayName: 'Target' },
      { id: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f', displayName: 'Self' },
    ]);
  });

  it('POST /conversations/:id/messages returns 401 without auth', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4/messages')
      .send({ body: 'Hello team' });

    expect(response.status).toBe(401);
  });

  it('POST /conversations/:id/messages returns 422 for invalid body', async () => {
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .post('/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: '' });

    expect(response.status).toBe(422);
  });

  it('POST /conversations/:id/messages delegates to chat proxy', async () => {
    chatProxyMocks.createMessage.mockResolvedValue({
      id: '11111111-2222-3333-4444-555555555555',
      conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      senderId: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      body: 'Hello team',
      createdAt: '2026-01-01T00:01:00.000Z',
      reactions: [],
    });
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .post('/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Hello team' });

    expect(response.status).toBe(201);
    expect(chatProxyMocks.createMessage).toHaveBeenCalledWith(
      '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      { body: 'Hello team' },
    );
  });

  it('GET /conversations/:id/messages returns 422 for invalid limit', async () => {
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get('/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4/messages?limit=0')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(422);
  });

  it('GET /conversations/:id/messages delegates with query params', async () => {
    chatProxyMocks.listMessages.mockResolvedValue([
      {
        id: '11111111-2222-3333-4444-555555555555',
        conversationId: '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
        senderId: 'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
        body: 'Hello team',
        createdAt: '2026-01-01T00:01:00.000Z',
        reactions: [],
      },
    ]);
    const app = createApp();
    const token = makeAccessToken('dc40ca49-b0f2-4b27-a771-5fda47d1d66f');

    const response = await request(app)
      .get(
        '/conversations/7af7345f-5419-47f1-b1a3-f25e31e0f1e4/messages?limit=10&before=11111111-2222-3333-4444-555555555555',
      )
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(chatProxyMocks.listMessages).toHaveBeenCalledWith(
      '7af7345f-5419-47f1-b1a3-f25e31e0f1e4',
      'dc40ca49-b0f2-4b27-a771-5fda47d1d66f',
      {
        limit: 10,
        before: '11111111-2222-3333-4444-555555555555',
        after: undefined,
      },
    );
  });
});
