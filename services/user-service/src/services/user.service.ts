import { env } from '@/config/env';
import { enqueueOutboxEvent, sequelize } from '@/db';
import { publishUserCreatedEvent } from '@/messaging/event-publisher';
import { userRepository, UserRepository } from '@/repository/user.repositories';
import { CreateUserInput, GetUsersByIdsInput, User, UserSummary } from '@/types/user';
import {
  AuthUserRegisteredPayload,
  HttpError,
  USER_CREATED_ROUTING_KEY,
  USER_EVENTS_EXCHANGE,
} from '@chatapp/common';
import { logger } from '@/utils/logger';
import { UniqueConstraintError } from 'sequelize';

class UserService {
  constructor(private readonly repository: UserRepository) {}

  async getUserById(id: string): Promise<User> {
    const user = await this.repository.findById(id);
    if (!user) {
      throw new HttpError(404, 'User not found');
    }
    return user;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    try {
      if (!env.OUTBOX_ENABLED) {
        const user = await this.repository.create(input);
        try {
          await publishUserCreatedEvent({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          });
        } catch (error) {
          logger.warn(
            {
              err: error,
              userId: user.id,
              email: user.email,
              displayName: user.displayName,
            },
            'user.created publish failed in non-outbox mode',
          );
        }
        return user;
      }

      return sequelize.transaction(async (transaction) => {
        const user = await this.repository.create(input, transaction);
        const payload = {
          type: USER_CREATED_ROUTING_KEY,
          payload: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
          occurredAt: new Date().toISOString(),
          occuredAt: new Date().toISOString(),
          metadata: { version: 1 },
        };
        await enqueueOutboxEvent(
          {
            eventType: USER_CREATED_ROUTING_KEY,
            exchangeName: USER_EVENTS_EXCHANGE,
            routingKey: USER_CREATED_ROUTING_KEY,
            payload,
            metadata: {
              aggregateType: 'user',
              aggregateId: user.id,
            },
          },
          transaction,
        );

        return user;
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new HttpError(409, 'User already Exists');
      }
      throw error;
    }
  }

  async searchUsers(params: {
    query: string;
    limit?: number;
    excludeIds?: string[];
  }): Promise<User[]> {
    const query = params.query.trim();
    if (query.length === 0) {
      return [];
    }

    return this.repository.searchByQuery(query, {
      limit: params.limit,
      excludeIds: params.excludeIds,
    });
  }
  async getAllUsers(): Promise<User[]> {
    return this.repository.findAll();
  }

  async getDmCandidates(userId: string): Promise<UserSummary[]> {
    return this.repository.findAllExcept(userId);
  }

  async getUsersByIds(input: GetUsersByIdsInput): Promise<UserSummary[]> {
    return this.repository.findByIds(input.ids);
  }

  async syncFromAuthUser(payload: AuthUserRegisteredPayload): Promise<User> {
    if (!env.OUTBOX_ENABLED) {
      const user = await this.repository.upsertFromAuthEvent(payload);
      try {
        await publishUserCreatedEvent({
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        });
      } catch (error) {
        logger.warn(
          {
            err: error,
            userId: user.id,
            email: user.email,
            displayName: user.displayName,
          },
          'user.created publish failed in non-outbox mode',
        );
      }
      return user;
    }

    return sequelize.transaction(async (transaction) => {
      const user = await this.repository.upsertFromAuthEvent(payload, transaction);
      const eventPayload = {
        type: USER_CREATED_ROUTING_KEY,
        payload: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        occurredAt: new Date().toISOString(),
        occuredAt: new Date().toISOString(),
        metadata: { version: 1 },
      };
      await enqueueOutboxEvent(
        {
          eventType: USER_CREATED_ROUTING_KEY,
          exchangeName: USER_EVENTS_EXCHANGE,
          routingKey: USER_CREATED_ROUTING_KEY,
          payload: eventPayload,
          metadata: {
            aggregateType: 'user',
            aggregateId: user.id,
          },
        },
        transaction,
      );
      return user;
    });
  }
}

export const userService = new UserService(userRepository);
