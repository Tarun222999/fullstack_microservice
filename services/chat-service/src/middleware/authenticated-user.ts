import { HttpError, USER_ID_HEADER, z } from '@chatapp/common';
import type { RequestHandler } from 'express';

const userIdSchema = z.string().uuid();

export const attachAuthenticatedUser: RequestHandler = (req, _res, next) => {
    try {
        const headerValue = req.header(USER_ID_HEADER);
        const userId = userIdSchema.parse(headerValue);
        console.log("userid in authenticate-user.ts", userId)
        console.log("req.user before", req.user)
        req.user = { id: userId };
        next();
    } catch {
        next(new HttpError(401, 'Invalid or missing user context'));
    }
};