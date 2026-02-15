import { Op, type WhereOptions } from 'sequelize';

import type { CreateUserInput, User } from '@/types/user';
import type { AuthUserRegisteredPayload } from '@chatapp/common';

import { UserModel } from '@/db';



const toDomainUser = (model: UserModel): User => ({
    id: model.id,
    email: model.email,
    displayName: model.displayName,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
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

    async create(data: CreateUserInput): Promise<User> {
        const user = await UserModel.create(data)
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


    async upsertFromAuthEvent(payload: AuthUserRegisteredPayload): Promise<User> {
        const [user] = await UserModel.upsert(
            {
                id: payload.id,
                email: payload.email,
                displayName: payload.displayName,
                createdAt: new Date(payload.createdAt),
                updatedAt: new Date(payload.createdAt),
            }
        )

        return toDomainUser(user)
    }

}

export const userRepository = new UserRepository()