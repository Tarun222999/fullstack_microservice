import { publishUserCreatedEvent } from "@/messaging/event-publisher";
import { userRepository, UserRepository } from "@/repository/user.repositories";
import { CreateUserInput, User } from "@/types/user";
import { AuthUserRegisteredPayload, HttpError } from "@chatapp/common";
import { UniqueConstraintError } from "sequelize";




class UserService {
    constructor(private readonly repository: UserRepository) { }

    async getUserById(id: string): Promise<User> {
        const user = await this.repository.findById(id);
        if (!user) {
            throw new HttpError(404, 'User not found');
        }
        return user;
    }

    async createUser(input: CreateUserInput): Promise<User> {
        try {
            const user = await this.repository.create(input)

            void publishUserCreatedEvent({
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                createdAt: user.createdAt.toISOString(),
                updatedAt: user.updatedAt.toISOString(),
            });
            return user
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new HttpError(409, 'User already Exists')
            }
            throw error
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

    async syncFromAuthUser(payload: AuthUserRegisteredPayload): Promise<User> {
        const user = await this.repository.upsertFromAuthEvent(payload)
        void publishUserCreatedEvent({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
        });
        return user
    }
}

export const userService = new UserService(userRepository)