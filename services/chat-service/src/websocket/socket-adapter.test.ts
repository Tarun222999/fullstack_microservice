import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const quitMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const duplicateMock = vi.hoisted(() => vi.fn());
const adapterFactoryMock = vi.hoisted(() => vi.fn(() => 'adapter-instance'));
const ioAdapterMock = vi.hoisted(() => vi.fn());

const loggerMocks = vi.hoisted(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
}));

const pubClient = vi.hoisted(() => ({
    connect: connectMock,
    quit: quitMock,
}));

const subClient = vi.hoisted(() => ({
    connect: connectMock,
    quit: quitMock,
}));

vi.mock('@socket.io/redis-adapter', () => ({
    createAdapter: adapterFactoryMock,
}));

vi.mock('@/clients/redis.client', () => ({
    getRedisClient: vi.fn(() => ({
        duplicate: duplicateMock,
    })),
}));

vi.mock('@/utils/logger', () => ({
    logger: loggerMocks,
}));

import { attachSocketRedisAdapter, closeSocketRedisAdapter } from '@/websocket/socket-adapter';

describe('socket redis adapter', () => {
    beforeEach(async () => {
        await closeSocketRedisAdapter();
        connectMock.mockClear();
        quitMock.mockClear();
        adapterFactoryMock.mockClear();
        ioAdapterMock.mockClear();
        vi.clearAllMocks();
        duplicateMock.mockReset();
        duplicateMock.mockReturnValueOnce(pubClient).mockReturnValueOnce(subClient);
    });

    it('attaches the socket.io redis adapter using dedicated pub/sub clients', async () => {
        await attachSocketRedisAdapter({
            adapter: ioAdapterMock,
        } as never);

        expect(connectMock).toHaveBeenCalledTimes(2);
        expect(adapterFactoryMock).toHaveBeenCalledWith(pubClient, subClient);
        expect(ioAdapterMock).toHaveBeenCalledWith('adapter-instance');
    });

    it('closes pub/sub clients during shutdown', async () => {
        await attachSocketRedisAdapter({
            adapter: ioAdapterMock,
        } as never);

        await closeSocketRedisAdapter();

        expect(quitMock).toHaveBeenCalledTimes(2);
    });
});
