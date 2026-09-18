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
  let composeEnv = {};
  try {
    composeEnv = parseEnv(readFileSync(resolve(workspace, '.env'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const password =
    inherited.POSTGRES_PASSWORD ||
    composeEnv.POSTGRES_PASSWORD ||
    'local-development-only';
  const database =
    env.TEST_DATABASE_URL ??
    `postgresql://todo:${encodeURIComponent(password)}@127.0.0.1:55432/todo`;
  return {
    ...env,
    NODE_ENV: 'test',
    DATABASE_URL: database,
    DIRECT_URL: database,
    JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
    APP_ORIGIN: 'http://localhost:3000',
  };
}
