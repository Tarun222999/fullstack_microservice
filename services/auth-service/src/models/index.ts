import { sequelize } from '@/db/sequilize';
import { UserCredentials } from '@/models/user-credentials.model';
import { RefreshToken } from '@/models/refresh-token.model';
import { OutboxEvent, enqueueOutboxEvent } from '@/models/outbox-event.model';

export const initModels = async () => {
  await sequelize.sync();
};

export { UserCredentials, RefreshToken, OutboxEvent, enqueueOutboxEvent };
