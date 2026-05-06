import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { HttpError } from '@chatapp/common';

import { env } from '@/config/env';
import { logger } from '@/utils/logger';
import { closeSocketRedisAdapter, attachSocketRedisAdapter } from '@/websocket/socket-adapter';
import { authenticateSocket } from '@/websocket/socket-auth';
import { registerConversationSocketHandlers } from '@/websocket/conversation-socket';

let ioServer: SocketIOServer | null = null;
const userRoom = (userId: string) => `user:${userId}`;
const socketAllowedOrigins = env.CHAT_SOCKET_ALLOWED_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

export const startSocketServer = async (httpServer: HttpServer): Promise<SocketIOServer> => {
  if (ioServer) {
    return ioServer;
  }

  const localServer = new SocketIOServer(httpServer, {
    cors: {
      origin: socketAllowedOrigins,
      credentials: true,
    },
  });

  localServer.use((socket, next) => {
    try {
      const user = authenticateSocket(socket);
      socket.data.user = user;
      next();
    } catch (error) {
      const message = error instanceof HttpError ? error.message : 'Unauthorized';
      next(new Error(message));
    }
  });

  localServer.on('connection', (socket) => {
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

  try {
    await attachSocketRedisAdapter(localServer);
  } catch (error) {
    await localServer.close().catch(() => undefined);
    throw error;
  }

  ioServer = localServer;
  logger.info('Socket server initialized');
  return ioServer;
};

export const closeSocketServer = async (): Promise<void> => {
  if (!ioServer) {
    return;
  }

  const currentServer = ioServer;
  let closeError: unknown;
  let adapterError: unknown;

  try {
    await currentServer.close();
  } catch (error) {
    closeError = error;
  } finally {
    try {
      await closeSocketRedisAdapter();
    } catch (error) {
      adapterError = error;
    }

    ioServer = null;
    logger.info('Socket server closed');
  }

  if (closeError) {
    throw closeError;
  }

  if (adapterError) {
    throw adapterError;
  }
};

export { userRoom };
