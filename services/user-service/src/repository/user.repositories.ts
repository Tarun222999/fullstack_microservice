import { Op, Transaction, type WhereOptions } from 'sequelize';

import type { CreateUserInput, GetUsersByIdsInput, User, UserSummary } from '@/types/user';
import type { AuthUserRegisteredPayload } from '@chatapp/common';

import { UserModel } from '@/db';



const toDomainUser = (model: UserModel): User => ({
    id: model.id,
    email: model.email,
    displayName: model.displayName,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
})

const toUserSummary = (model: UserModel): UserSummary => ({
    id: model.id,
    displayName: model.displayName,
})

export class UserRepository {
    async findById(id: string): Promise<User | null> {
        const user = await UserModel.findByPk(id);
        return user ? toDomainUser(user) : null
    }

    async findAll(): Promise<User[]> {
        const users = await UserModel.findAll({
            order: [['displayName', 'ASC']],
        })
        return users.map(toDomainUser)
    }

    async findAllExcept(excludeId: string): Promise<UserSummary[]> {
        const users = await UserModel.findAll({
            where: {
                id: {
                    [Op.ne]: excludeId,
                },
            },
            order: [['displayName', 'ASC']],
        });

        return users.map(toUserSummary);
    }

    async findByIds(ids: GetUsersByIdsInput['ids']): Promise<UserSummary[]> {
        const uniqueIds = Array.from(new Set(ids));

        if (uniqueIds.length === 0) {
            return [];
        }

        const users = await UserModel.findAll({
            where: {
                id: {
                    [Op.in]: uniqueIds,
                },
            },
            order: [['displayName', 'ASC']],
        });

        return users.map(toUserSummary);
    }

    async create(data: CreateUserInput, transaction?: Transaction): Promise<User> {
        const user = await UserModel.create(data, { transaction })
        return toDomainUser(user)
    }

    async searchByQuery(
        query: string,
        options: { limit?: number; excludeIds?: string[] } = {},
    ): Promise<User[]> {
        const where: WhereOptions = {
            [Op.or]: [
                { displayName: { [Op.iLike]: `%${query}%` } },
                { email: { [Op.iLike]: `%${query}%` } },
            ],
        };

        if (options.excludeIds && options.excludeIds.length > 0) {
            Object.assign(where, {
                [Op.and]: [{ id: { [Op.notIn]: options.excludeIds } }],
            });
        }

        const users = await UserModel.findAll({
            where,
            order: [['displayName', 'ASC']],
            limit: options.limit ?? 10,
        });

        return users.map(toDomainUser);
    }


    async upsertFromAuthEvent(payload: AuthUserRegisteredPayload, transaction?: Transaction): Promise<User> {
        const [user] = await UserModel.upsert(
            {
                id: payload.id,
                email: payload.email,
                displayName: payload.displayName,
                createdAt: new Date(payload.createdAt),
                updatedAt: new Date(payload.createdAt),
            },
            { transaction },
        )

        return toDomainUser(user)
    }

}

export const userRepository = new UserRepository()
