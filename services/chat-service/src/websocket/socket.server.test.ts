import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketHandlers = new Map<string, (...args: unknown[]) => void>();
const ioHandlers = new Map<string, (...args: unknown[]) => void>();
let middlewareHandler: ((...args: unknown[]) => void) | undefined;

const closeMock = vi.fn().mockResolvedValue(undefined);
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

vi.mock('@/utils/logger', () => ({
    logger: loggerMocks,
}));

vi.mock('@/websocket/socket-auth', () => ({
    authenticateSocket: authMocks.authenticateSocket,
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

        const first = startSocketServer(httpServer);
        const second = startSocketServer(httpServer);

        expect(first).toBe(second);
        expect(ioHandlers.has('connection')).toBe(true);
        expect(middlewareHandler).toBeTypeOf('function');

        const socket = {
            id: 'socket-1',
            data: {},
            handshake: {
                auth: { token: 'token' },
                headers: {},
            },
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

        expect(loggerMocks.info).toHaveBeenCalledWith(
            { socketId: 'socket-1', userId: 'user-1' },
            'Socket connected',
        );

        socketHandlers.get('disconnect')?.('transport close');

        expect(loggerMocks.info).toHaveBeenCalledWith(
            { socketId: 'socket-1', userId: 'user-1', reason: 'transport close' },
            'Socket disconnected',
        );
    });

    it('closes the socket server and resets singleton state', async () => {
        const httpServer = {} as never;

        startSocketServer(httpServer);
        await closeSocketServer();

        expect(closeMock).toHaveBeenCalledTimes(1);

        const restarted = startSocketServer(httpServer);
        expect(restarted).toBeDefined();
    });

    it('rejects unauthorized sockets in middleware', async () => {
        const httpServer = {} as never;
        authMocks.authenticateSocket.mockImplementation(() => {
            throw new Error('bad token');
        });

        startSocketServer(httpServer);

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
});
