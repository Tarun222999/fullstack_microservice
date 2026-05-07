import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.db.test.ts'],
    globals: true,
    clearMocks: true,
    setupFiles: ['src/test/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@chatapp/common': path.resolve(__dirname, '../../packages/common/src/index.ts'),
    },
  },
});
