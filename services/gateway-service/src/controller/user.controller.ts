import { userProxyService } from '@/services/user-proxy.service';
import { getAuthenticatedUser } from '@/utils/auth';
import {
    createUserSchema,
    SearchUsersQuery,
    searchUsersQuerySchema,
    userIdParamsSchema,
} from '@/validation/user.schema';
import { AsyncHandler } from '@chatapp/common';

export const getUser: AsyncHandler = async (req, res, next) => {
    try {
        const { id } = userIdParamsSchema.parse(req.params);
        const response = await userProxyService.getUserById(id);
        res.json(response);
    } catch (error) {
        next(error);
    }
};

export const getAllUsers: AsyncHandler = async (req, res, next) => {
    try {
        const response = await userProxyService.getAllUsers();
        res.json(response);
    } catch (error) {
        next(error);
    }
};

export const createUser: AsyncHandler = async (req, res, next) => {
    try {
        const payload = createUserSchema.parse(req.body);
        const response = await userProxyService.createUser(payload);
        res.status(201).json(response);
    } catch (error) {
        next(error);
    }
};

export const searchUsers: AsyncHandler = async (req, res, next) => {
    try {
        const user = getAuthenticatedUser(req);
        const parsedQuery: SearchUsersQuery = searchUsersQuerySchema.parse(req.query);
        const { query, limit, exclude } = parsedQuery;
        const sanitizedExclude = Array.from(new Set([...exclude, user.id]));

        const users = await userProxyService.searchUsers({
            query,
            limit,
            exclude: sanitizedExclude,
        });
        res.json({ data: users });
    } catch (error) {
        next(error);
    }
};