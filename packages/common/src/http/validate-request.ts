import { HttpError } from '../errors/http-error';

import type { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny, ZodObject, type ZodRawShape } from 'zod';

type AnyZodObject = ZodObject<ZodRawShape>;

type Schema = AnyZodObject | ZodTypeAny;
type ParamsRecord = Record<string, string>;
type QueryRecord = Record<string, unknown>;
type MutableObject = Record<string, unknown>;

export interface RequestValidationSchema {
  body?: Schema;
  params?: Schema;
  query?: Schema;
}

const formatedError = (error: ZodError): Array<{ path: string; message: string }> =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));

const assignIfWritable = (target: Request, key: 'body' | 'params' | 'query', value: unknown) => {
  const mutableTarget = target as unknown as Record<string, unknown>;

  try {
    // In some Express runtimes (notably query in v5), direct assignment can throw.
    mutableTarget[key] = value;
  } catch {
    const current = mutableTarget[key];
    if (current && typeof current === 'object' && value && typeof value === 'object') {
      const currentObject = current as MutableObject;
      for (const existingKey of Object.keys(currentObject)) {
        delete currentObject[existingKey];
      }
      Object.assign(currentObject, value as MutableObject);
    }
  }
};

export const validateRequest = (schemas: RequestValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        const parsedBody = schemas.body.parse(req.body) as unknown;
        assignIfWritable(req, 'body', parsedBody);
      }
      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params) as ParamsRecord;
        assignIfWritable(req, 'params', parsedParams as Request['params']);
      }
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query) as QueryRecord;
        assignIfWritable(req, 'query', parsedQuery as Request['query']);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new HttpError(422, 'Validation Error', {
            issues: formatedError(error),
          }),
        );
        return;
      }
      next(error);
    }
  };
};
