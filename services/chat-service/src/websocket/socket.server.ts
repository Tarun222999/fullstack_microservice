import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { HttpError } from '@chatapp/common';

import { logger } from '@/utils/logger';
import { authenticateSocket } from '@/websocket/socket-auth';

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

    ioServer.use((socket, next) => {
        try {
            const user = authenticateSocket(socket);
            socket.data.user = user;
            next();
        } catch (error) {
            const message = error instanceof HttpError ? error.message : 'Unauthorized';
            next(new Error(message));
        }
    });

    ioServer.on('connection', (socket) => {
        logger.info({ socketId: socket.id, userId: socket.data.user.id }, 'Socket connected');

        socket.on('disconnect', (reason) => {
            logger.info(
                { socketId: socket.id, userId: socket.data.user.id, reason },
                'Socket disconnected',
            );
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
