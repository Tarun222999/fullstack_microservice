import { DataTypes, Model, Optional, Transaction } from 'sequelize';
import { sequelize } from '@/db/sequilize';

export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed' | 'dead';

export interface OutboxEventAttributes {
  id: string;
  eventType: string;
  exchangeName: string;
  routingKey: string;
  payloadJson: string;
  metadataJson: string | null;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OutboxEventCreationAttributes = Optional<
  OutboxEventAttributes,
  | 'id'
  | 'metadataJson'
  | 'status'
  | 'attempts'
  | 'nextAttemptAt'
  | 'lockedAt'
  | 'lockedBy'
  | 'lastError'
  | 'publishedAt'
  | 'createdAt'
  | 'updatedAt'
>;

export class OutboxEvent
  extends Model<OutboxEventAttributes, OutboxEventCreationAttributes>
  implements OutboxEventAttributes
{
  declare id: string;
  declare eventType: string;
  declare exchangeName: string;
  declare routingKey: string;
  declare payloadJson: string;
  declare metadataJson: string | null;
  declare status: OutboxStatus;
  declare attempts: number;
  declare nextAttemptAt: Date | null;
  declare lockedAt: Date | null;
  declare lockedBy: string | null;
  declare lastError: string | null;
  declare publishedAt: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

OutboxEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    eventType: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    exchangeName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    routingKey: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    payloadJson: {
      type: DataTypes.TEXT('long'),
      allowNull: false,
    },
    metadataJson: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'published', 'failed', 'dead'),
      allowNull: false,
      defaultValue: 'pending',
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    nextAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lockedBy: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'outbox_events',
    indexes: [
      { fields: ['status', 'next_attempt_at', 'created_at'] },
      { fields: ['locked_at'] },
      { fields: ['event_type', 'created_at'] },
    ],
  },
);

export interface EnqueueOutboxInput {
  eventType: string;
  exchangeName: string;
  routingKey: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

export const enqueueOutboxEvent = async (
  input: EnqueueOutboxInput,
  transaction?: Transaction,
): Promise<OutboxEvent> => {
  return OutboxEvent.create(
    {
      eventType: input.eventType,
      exchangeName: input.exchangeName,
      routingKey: input.routingKey,
      payloadJson: JSON.stringify(input.payload),
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      status: 'pending',
    },
    { transaction },
  );
};
