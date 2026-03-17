import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketHandlers = new Map<string, (...args: unknown[]) => void>();
const ioHandlers = new Map<string, (...args: unknown[]) => void>();

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
        close: closeMock,
    })),
}));

vi.mock('@/utils/logger', () => ({
    logger: loggerMocks,
}));

import { closeSocketServer, startSocketServer } from '@/websocket/socket.server';

describe('socket server bootstrap', () => {
    beforeEach(async () => {
        await closeSocketServer();
        ioHandlers.clear();
        socketHandlers.clear();
        closeMock.mockClear();
        vi.clearAllMocks();
    });

    it('initializes once and logs connect/disconnect lifecycle', async () => {
        const httpServer = {} as never;

        const first = startSocketServer(httpServer);
        const second = startSocketServer(httpServer);

        expect(first).toBe(second);
        expect(ioHandlers.has('connection')).toBe(true);

        const connectionHandler = ioHandlers.get('connection');
        connectionHandler?.({
            id: 'socket-1',
            on: (event: string, handler: (...args: unknown[]) => void) => {
                socketHandlers.set(event, handler);
            },
        });

        expect(loggerMocks.info).toHaveBeenCalledWith(
            { socketId: 'socket-1' },
            'Socket connected',
        );

        socketHandlers.get('disconnect')?.('transport close');

        expect(loggerMocks.info).toHaveBeenCalledWith(
            { socketId: 'socket-1', reason: 'transport close' },
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
});
