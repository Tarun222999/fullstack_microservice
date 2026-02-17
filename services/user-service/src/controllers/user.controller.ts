import { userService } from '@/services/user.service';
import { CreateUserBody, SearchUsersQuery, UserIdParams } from '@/validation/user.schema';
import type { AsyncHandler } from '@chatapp/common';

export const getUser: AsyncHandler = async (req, res, next) => {
    try {
        const { id } = req.params as unknown as UserIdParams;
        const user = await userService.getUserById(id);
        res.json({ data: user });
    } catch (error) {
        next(error);
    }
};

export const getAllUsers: AsyncHandler = async (req, res, next) => {
    try {
        const users = await userService.getAllUsers();
        res.json({ data: users });
    } catch (error) {
        next(error);
    }
};

export const createUser: AsyncHandler = async (req, res, next) => {
    try {
        const payload = req.body as CreateUserBody;
        const user = await userService.createUser(payload);
        res.status(201).json({ data: user });
    } catch (error) {
        next(error);
    }
};

export const searchUsers: AsyncHandler = async (req, res, next) => {
    try {
        const { query, limit, exclude } = req.query as unknown as SearchUsersQuery;
        const user = await userService.searchUsers({
            query,
            limit,
            excludeIds: exclude,
        });
        res.json({ data: user });
    } catch (error) {
        next(error);
    }
};