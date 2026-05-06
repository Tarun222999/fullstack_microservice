import { io } from 'socket.io-client';

type Options = {
  url: string;
  token: string;
  conversationId?: string;
  message?: string;
  clientMessageId?: string;
  label: string;
  sendDelayMs: number;
};

const parseArgs = (): Options => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const value = args[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    values.set(key, value);
    index += 1;
  }

  const token = values.get('token');
  if (!token) {
    throw new Error('Missing required --token');
  }

  return {
    url: values.get('url') ?? 'http://localhost:4002',
    token,
    conversationId: values.get('conversationId'),
    message: values.get('message'),
    clientMessageId: values.get('clientMessageId'),
    label: values.get('label') ?? 'socket-client',
    sendDelayMs: Number(values.get('sendDelayMs') ?? '500'),
  };
};

const log = (label: string, message: string, payload?: unknown) => {
  const timestamp = new Date().toISOString();
  if (payload === undefined) {
    console.log(`[${timestamp}] [${label}] ${message}`);
    return;
  }

  console.log(`[${timestamp}] [${label}] ${message}`, payload);
};

const main = async () => {
  const options = parseArgs();

  const socket = io(options.url, {
    auth: {
      token: options.token,
    },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    log(options.label, `connected with socket id ${socket.id}`);

    if (!options.conversationId) {
      log(options.label, 'no conversationId provided; listening only');
      return;
    }

    socket.emit('conversation:join', { conversationId: options.conversationId }, (ack: unknown) => {
      log(options.label, 'conversation:join ack', ack);

      if (!options.message) {
        return;
      }

      setTimeout(() => {
        socket.emit(
          'message:send',
          {
            conversationId: options.conversationId,
            body: options.message,
            ...(options.clientMessageId ? { clientMessageId: options.clientMessageId } : {}),
          },
          (messageAck: unknown) => {
            log(options.label, 'message:send ack', messageAck);
          },
        );
      }, options.sendDelayMs);
    });
  });

  socket.on('connect_error', (error) => {
    log(options.label, 'connect_error', { message: error.message });
  });

  socket.on('message:new', (payload) => {
    log(options.label, 'message:new', payload);
  });

  socket.on('message:error', (payload) => {
    log(options.label, 'message:error', payload);
  });

  socket.on('disconnect', (reason) => {
    log(options.label, `disconnected: ${reason}`);
  });
};

void main().catch((error) => {
  console.error('[manual-socket-client] fatal error', error);
  process.exit(1);
});
