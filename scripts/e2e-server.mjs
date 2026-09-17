import { readTestEnv } from './env.mjs';
const testEnv = readTestEnv();
// Override test credentials without copying API-only settings such as PORT
// into the frontend's environment.
for (const key of [
  'DATABASE_URL',
  'DIRECT_URL',
  'JWT_SECRET',
  'NODE_ENV',
  'APP_ORIGIN',
]) {
  process.env[key] = testEnv[key];
}
await import('./dev.mjs');
