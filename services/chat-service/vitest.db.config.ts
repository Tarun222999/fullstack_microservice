import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.db.test.ts'],
        globals: true,
        clearMocks: true,
        setupFiles: ['src/test/setup-db-env.ts'],
        testTimeout: 120000,
        hookTimeout: 120000,
        fileParallelism: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
});
