import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAppEnv, readTestEnv } from '../scripts/env.mjs';
const directories: string[] = [];
function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'todo-env-'));
  directories.push(directory);
  for (const app of ['api', 'web'])
    mkdirSync(join(directory, 'apps', app), { recursive: true });
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
describe('app environment loading', () => {
  it('loads app files separately and preserves injected overrides', () => {
    const directory = workspace();
    writeFileSync(
      join(directory, 'apps/api/.env'),
      'JWT_SECRET="api-only"\nPORT=3001\n',
    );
    writeFileSync(
      join(directory, 'apps/web/.env'),
      'API_URL=http://localhost:4000\n',
    );
    expect(readAppEnv('api', { PORT: '4001' }, directory)).toEqual({
      JWT_SECRET: 'api-only',
      PORT: '4001',
    });
    expect(readAppEnv('web', {}, directory)).toEqual({
      API_URL: 'http://localhost:4000',
    });
  });
  it('supports injected configuration without a file or generated secrets', () => {
    expect(
      readAppEnv('api', { DATABASE_URL: 'injected' }, workspace()),
    ).toEqual({ DATABASE_URL: 'injected' });
  });
  it('uses the Compose database in tests', () => {
    const directory = workspace();
    writeFileSync(
      join(directory, 'apps/api/.env'),
      'DATABASE_URL=development\nDIRECT_URL=development-direct\n',
    );
    const env = readTestEnv({}, directory);
    expect(env.DATABASE_URL).toMatch(/\/todo$/);
    expect(env.DIRECT_URL).toBe(env.DATABASE_URL);
    expect(env.NODE_ENV).toBe('test');
  });
  it('uses the Compose password when one is configured', () => {
    const directory = workspace();
    writeFileSync(join(directory, '.env'), 'POSTGRES_PASSWORD=custom-secret\n');
    expect(readTestEnv({}, directory).DATABASE_URL).toBe(
      'postgresql://todo:custom-secret@127.0.0.1:55432/todo',
    );
  });
  it('uses the test URL from the file with shell overrides taking precedence', () => {
    const directory = workspace();
    writeFileSync(
      join(directory, 'apps/api/.env'),
      'TEST_DATABASE_URL=file-test\n',
    );
    expect(readTestEnv({}, directory).DATABASE_URL).toBe('file-test');
    const env = readTestEnv(
      { TEST_DATABASE_URL: 'ci-test', DIRECT_URL: 'production' },
      directory,
    );
    expect(env.DATABASE_URL).toBe('ci-test');
    expect(env.DIRECT_URL).toBe('ci-test');
  });
});
