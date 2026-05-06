import {
  createUser,
  getAllUsers,
  getDmCandidates,
  getUser,
  getUsersByIds,
  searchUsers,
} from '@/controllers/user.controller';
import {
  createUserSchema,
  getUsersByIdsSchema,
  searchUsersQuerySchema,
  userIdParamsSchema,
} from '@/validation/user.schema';
import { asyncHandler, validateRequest } from '@chatapp/common';
import { Router } from 'express';

export const userRoutes: Router = Router();

userRoutes.get('/', asyncHandler(getAllUsers));
userRoutes.get('/dm-candidates', asyncHandler(getDmCandidates));
userRoutes.get(
  '/search',
  validateRequest({ query: searchUsersQuerySchema }),
  asyncHandler(searchUsers),
);
userRoutes.post(
  '/by-ids',
  validateRequest({ body: getUsersByIdsSchema }),
  asyncHandler(getUsersByIds),
);
userRoutes.get('/:id', validateRequest({ params: userIdParamsSchema }), asyncHandler(getUser));
userRoutes.post('/', validateRequest({ body: createUserSchema }), asyncHandler(createUser));
