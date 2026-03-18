import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketHandlers = new Map<string, (...args: unknown[]) => void>();
const ioHandlers = new Map<string, (...args: unknown[]) => void>();
let middlewareHandler: ((...args: unknown[]) => void) | undefined;

const closeMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const loggerMocks = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
}));

vi.mock('socket.io', () => ({
    Server: vi.fn().mockImplementation(() => ({
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
            ioHandlers.set(event, handler);
        }),
        use: vi.fn((handler: (...args: unknown[]) => void) => {
            middlewareHandler = handler;
        }),
        close: closeMock,
    })),
}));

const authMocks = vi.hoisted(() => ({
    authenticateSocket: vi.fn(),
}));

const adapterMocks = vi.hoisted(() => ({
    attachSocketRedisAdapter: vi.fn().mockResolvedValue(undefined),
    closeSocketRedisAdapter: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/logger', () => ({
    logger: loggerMocks,
}));

vi.mock('@/websocket/socket-auth', () => ({
    authenticateSocket: authMocks.authenticateSocket,
}));

vi.mock('@/websocket/socket-adapter', () => ({
    attachSocketRedisAdapter: adapterMocks.attachSocketRedisAdapter,
    closeSocketRedisAdapter: adapterMocks.closeSocketRedisAdapter,
}));

import { closeSocketServer, startSocketServer } from '@/websocket/socket.server';

describe('socket server bootstrap', () => {
    beforeEach(async () => {
        await closeSocketServer();
        ioHandlers.clear();
        socketHandlers.clear();
        middlewareHandler = undefined;
        closeMock.mockClear();
        vi.clearAllMocks();
        authMocks.authenticateSocket.mockReturnValue({
            id: 'user-1',
            email: 'user@example.com',
        });
    });

    it('initializes once and logs connect/disconnect lifecycle', async () => {
        const httpServer = {} as never;

        const first = await startSocketServer(httpServer);
        const second = await startSocketServer(httpServer);

        expect(first).toBe(second);
        expect(ioHandlers.has('connection')).toBe(true);
        expect(middlewareHandler).toBeTypeOf('function');
        expect(adapterMocks.attachSocketRedisAdapter).toHaveBeenCalledTimes(1);

        const join = vi.fn();
        const socket = {
            id: 'socket-1',
            data: {},
            handshake: {
                auth: { token: 'token' },
                headers: {},
            },
            join,
            on: (event: string, handler: (...args: unknown[]) => void) => {
                socketHandlers.set(event, handler);
            },
        };

        const next = vi.fn();
        middlewareHandler?.(socket, next);

        expect(authMocks.authenticateSocket).toHaveBeenCalledWith(socket);
        expect(socket.data).toEqual({
            user: {
                id: 'user-1',
                email: 'user@example.com',
            },
        });
        expect(next).toHaveBeenCalledWith();

        const connectionHandler = ioHandlers.get('connection');
        connectionHandler?.(socket);

        expect(join).toHaveBeenCalledWith('user:user-1');

        expect(loggerMocks.info).toHaveBeenCalledWith(
            { socketId: 'socket-1', userId: 'user-1', room: 'user:user-1' },
            'Socket connected',
        );

        socketHandlers.get('disconnect')?.('transport close');

        expect(loggerMocks.info).toHaveBeenCalledWith(
            {
                socketId: 'socket-1',
                userId: 'user-1',
                room: 'user:user-1',
                reason: 'transport close',
            },
            'Socket disconnected',
        );
    });

    it('closes the socket server and resets singleton state', async () => {
        const httpServer = {} as never;

        await startSocketServer(httpServer);
        await closeSocketServer();

        expect(closeMock).toHaveBeenCalledTimes(1);
        expect(adapterMocks.closeSocketRedisAdapter).toHaveBeenCalledTimes(1);

        const restarted = await startSocketServer(httpServer);
        expect(restarted).toBeDefined();
    });

    it('rejects unauthorized sockets in middleware', async () => {
        const httpServer = {} as never;
        authMocks.authenticateSocket.mockImplementation(() => {
            throw new Error('bad token');
        });

        await startSocketServer(httpServer);

        const next = vi.fn();
        middlewareHandler?.(
            {
                data: {},
                handshake: {
                    auth: {},
                    headers: {},
                },
            },
            next,
        );

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect((next.mock.calls[0][0] as Error).message).toBe('Unauthorized');
    });

    it('cleans up the local socket server when adapter attach fails', async () => {
        const httpServer = {} as never;
        adapterMocks.attachSocketRedisAdapter.mockRejectedValueOnce(new Error('adapter failed'));

        await expect(startSocketServer(httpServer)).rejects.toThrow('adapter failed');
        expect(closeMock).toHaveBeenCalledTimes(1);
    });
});
