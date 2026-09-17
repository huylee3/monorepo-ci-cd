import { defineConfig } from 'vitest/config';
import { readTestEnv } from './scripts/env.mjs';
Object.assign(process.env, readTestEnv());
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/*.unit.test.ts'] } },
      {
        test: {
          name: 'integration',
          include: ['tests/*.integration.test.ts'],
          fileParallelism: false,
          testTimeout: 15000,
        },
      },
      {
        test: {
          name: 'mock',
          include: ['tests/*.mock.test.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
