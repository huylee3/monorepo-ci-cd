import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
export const root = resolve(import.meta.dirname, '..');

// Read only the selected app's file. Shell/CI variables always take precedence.
export function readAppEnv(app, inherited = process.env, workspace = root) {
  let values = {};
  try {
    values = parseEnv(
      readFileSync(resolve(workspace, 'apps', app, '.env'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { ...values, ...inherited };
}

export function readTestEnv(inherited = process.env, workspace = root) {
  const env = readAppEnv('api', inherited, workspace);
  const database = env.TEST_DATABASE_URL;
  if (!database) {
    throw new Error(
      'Set TEST_DATABASE_URL to a dedicated PostgreSQL test database.',
    );
  }
  const target = new URL(database);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('TEST_DATABASE_URL must be a PostgreSQL URL.');
  }
  // Compare database identity, not credentials or connection query parameters.
  if (env.DATABASE_URL) {
    const development = new URL(env.DATABASE_URL);
    const identity = (url) =>
      [
        url.hostname === 'localhost' ? '127.0.0.1' : url.hostname,
        url.port || '5432',
        decodeURIComponent(url.pathname),
      ].join(':');
    if (identity(target) === identity(development)) {
      throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL.');
    }
  }
  return {
    ...env,
    NODE_ENV: 'test',
    DATABASE_URL: database,
    DIRECT_URL: database,
    JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
    APP_ORIGIN: 'http://localhost:3000',
  };
}
