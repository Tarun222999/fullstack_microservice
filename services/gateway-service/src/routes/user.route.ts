import { createUser, getAllUsers, getUser, searchUsers } from '@/controller/user.controller';
import { requireAuth } from '@/middleware/require-auth';
import { createUserSchema, searchUsersQuerySchema, userIdParamsSchema } from '@/validation/user.schema';
import { asyncHandler, validateRequest } from '@chatapp/common';
import { Router } from 'express';

export const userRouter: Router = Router();

userRouter.get('/', requireAuth, asyncHandler(getAllUsers));
userRouter.get('/search', requireAuth, validateRequest({ query: searchUsersQuerySchema }), asyncHandler(searchUsers));
userRouter.get('/:id', requireAuth, validateRequest({ params: userIdParamsSchema }), asyncHandler(getUser));
userRouter.post('/', validateRequest({ body: createUserSchema }), asyncHandler(createUser));