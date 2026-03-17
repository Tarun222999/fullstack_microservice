import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { HttpError } from '@chatapp/common';

import { logger } from '@/utils/logger';
import { authenticateSocket } from '@/websocket/socket-auth';
import { registerConversationSocketHandlers } from '@/websocket/conversation-socket';

let ioServer: SocketIOServer | null = null;
const userRoom = (userId: string) => `user:${userId}`;

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
        const room = userRoom(socket.data.user.id);
        socket.join(room);
        logger.info({ socketId: socket.id, userId: socket.data.user.id, room }, 'Socket connected');
        registerConversationSocketHandlers(socket);

        socket.on('disconnect', (reason) => {
            logger.info(
                { socketId: socket.id, userId: socket.data.user.id, room, reason },
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

export { userRoom };
