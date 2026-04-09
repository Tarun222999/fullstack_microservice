import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const openApiSpecCandidates = [
    path.resolve(process.cwd(), '../../docs/openapi.yaml'),
    path.resolve(process.cwd(), '../docs/openapi.yaml'),
    path.resolve(process.cwd(), 'docs/openapi.yaml'),
];

const resolveOpenApiSpecPath = (): string => {
    for (const candidate of openApiSpecCandidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }

    return openApiSpecCandidates[0];
};

const readOpenApiSpec = (): string => readFileSync(resolveOpenApiSpecPath(), 'utf8');

export const docsRouter: Router = Router();

docsRouter.get('/openapi.yaml', (_req, res) => {
    res.type('yaml').send(readOpenApiSpec());
});

docsRouter.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
        customSiteTitle: 'ChatApp API Docs',
        swaggerOptions: {
            url: '/openapi.yaml',
        },
    }),
);
