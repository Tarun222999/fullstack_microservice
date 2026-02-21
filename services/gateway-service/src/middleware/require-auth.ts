import { HttpError, type AuthenticatedUser } from "@chatapp/common";
import jwt from 'jsonwebtoken'
import type { RequestHandler } from "express";
import { env } from "@/config/env"

interface AccessTokenClaims {
    sub: string;
    email?: string;
}

const parseAuthorizationHeader = (value: string | undefined): string => {
    if (!value) {
        throw new HttpError(401, 'Unauthorized')
    }

    const [scheme, token] = value.split(' ')

    if (scheme.toLowerCase() !== 'bearer' || !token) {
        throw new HttpError(401, 'Unauthorized')
    }

    return token;

}

const toAuthenticatedUser = (claims: AccessTokenClaims): AuthenticatedUser => {
    if (!claims.sub) {
        throw new HttpError(401, 'Unauthorized')
    }

    return {
        id: claims.sub,
        email: claims.email
    }
}


export const requireAuth: RequestHandler = (req, _res, next) => {
    try {
        const token = parseAuthorizationHeader(req.headers.authorization)
        const claims = jwt.verify(token, env.JWT_SECRET) as AccessTokenClaims
        req.user = toAuthenticatedUser(claims)
        next()
    } catch (error) {

        if (error instanceof HttpError) {
            next(error)
            return
        }
        next(new HttpError(401, 'Unauthorized'))
    }
}