import { spawnSync } from 'node:child_process';
import { readAppEnv, readTestEnv, root } from './env.mjs';
const result = spawnSync(
  'pnpm',
  ['--filter', '@todo/api', 'exec', 'prisma', 'migrate', 'deploy'],
  {
    cwd: root,
    env: process.argv.includes('--test') ? readTestEnv() : readAppEnv('api'),
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
