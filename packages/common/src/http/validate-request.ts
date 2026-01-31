import { z } from "zod"
import { HttpError } from "../errors/http-error"

import type { NextFunction, Request, Response } from "express"
import { ZodError, ZodTypeAny, ZodObject } from "zod";

type AnyZodObject = ZodObject<any>;

type Schema = AnyZodObject | ZodTypeAny
type ParamsRecord = Record<string, string>
type QueryRecord = Record<string, unknown>

export interface RequestValidationSchema {
    body?: Schema;
    params?: Schema;
    query?: Schema
}

const formatedError = (error: ZodError): Array<{ path: string; message: string }> =>
    error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
    }))


export const validateRequest = (schemas: RequestValidationSchema) => {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            if (schemas.body) {
                const parsedBody = schemas.body.parse(req.body) as unknown
                req.body = parsedBody
            }
            if (schemas.params) {
                const parsedParams = schemas.params.parse(req.params) as ParamsRecord
                req.params = parsedParams as Request["params"]
            }
            if (schemas.query) {
                const parsedQuery = schemas.query.parse(req.query) as QueryRecord
                req.query = parsedQuery as Request["query"]
            }
            next()
        } catch (error) {
            if (error instanceof ZodError) {
                next(
                    new HttpError(422, "Validation Error", {
                        issues: formatedError(error)
                    })
                )
                return
            }
            next(error)
        }

    }
}   