import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { logger } from '@/utils/logger';

let ioServer: SocketIOServer | null = null;

export const startSocketServer = (httpServer: HttpServer): SocketIOServer => {
    if (ioServer) {
        return ioServer;
    }

    ioServer = new SocketIOServer(httpServer, {
        cors: {
            origin: '*',
            credentials: true,
        },
    });

    ioServer.on('connection', (socket) => {
        logger.info({ socketId: socket.id }, 'Socket connected');

        socket.on('disconnect', (reason) => {
            logger.info({ socketId: socket.id, reason }, 'Socket disconnected');
        });
    });

    logger.info('Socket server initialized');
    return ioServer;
};

export const closeSocketServer = async (): Promise<void> => {
    if (!ioServer) {
        return;
    }

    await ioServer.close();
    ioServer = null;
    logger.info('Socket server closed');
};
