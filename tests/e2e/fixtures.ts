import { randomUUID } from 'node:crypto';
import { test as base, expect } from '@playwright/test';
import { readTestEnv } from '../../scripts/env.mjs';

type Database = typeof import('../../apps/api/src/repositories/database').db;

export const test = base.extend<
  { account: { username: string; password: string } },
  { database: Database }
>({
  database: [
    async ({}, use: (db: Database) => Promise<void>) => {
      Object.assign(process.env, readTestEnv());
      const { db } = await import('../../apps/api/src/repositories/database');
      try {
        await use(db);
      } finally {
        await db.$disconnect();
      }
    },
    { scope: 'worker' },
  ],
  account: async ({ database }, use) => {
    const username = `e2e_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    try {
      await use({ username, password: 'a very memorable test passphrase' });
    } finally {
      await database.user.deleteMany({ where: { username } });
    }
  },
});

export { expect };
