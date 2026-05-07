import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '@/db/sequelize';

export type ProcessedEventStatus = 'processing' | 'processed' | 'failed';

export interface ProcessedEventAttributes {
  eventId: string;
  eventType: string;
  consumerName: string;
  status: ProcessedEventStatus;
  lockedAt: Date | null;
  processedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type ProcessedEventCreationAttributes = Optional<
  ProcessedEventAttributes,
  'status' | 'lockedAt' | 'processedAt' | 'lastError' | 'createdAt' | 'updatedAt'
>;

export class ProcessedEventModel
  extends Model<ProcessedEventAttributes, ProcessedEventCreationAttributes>
  implements ProcessedEventAttributes
{
  declare eventId: string;
  declare eventType: string;
  declare consumerName: string;
  declare status: ProcessedEventStatus;
  declare lockedAt: Date | null;
  declare processedAt: Date | null;
  declare lastError: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProcessedEventModel.init(
  {
    eventId: {
      type: DataTypes.STRING(120),
      allowNull: false,
      primaryKey: true,
      field: 'event_id',
    },
    eventType: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'event_type',
    },
    consumerName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      field: 'consumer_name',
    },
    status: {
      type: DataTypes.ENUM('processing', 'processed', 'failed'),
      allowNull: false,
      defaultValue: 'processing',
    },
    lockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'locked_at',
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_error',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'processed_events',
    indexes: [{ fields: ['status', 'locked_at'] }, { fields: ['event_type', 'created_at'] }],
  },
);
