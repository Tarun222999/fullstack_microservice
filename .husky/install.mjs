import { existsSync } from 'node:fs';

if (!existsSync('.git')) {
  process.exit(0);
}

const husky = (await import('husky')).default;

husky();
