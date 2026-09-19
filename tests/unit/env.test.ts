import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readAppEnv, readTestEnv } from '../../scripts/env.mjs';
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
  it('requires an explicit test database without falling back to development', () => {
    expect(() => readTestEnv({}, workspace())).toThrow('Set TEST_DATABASE_URL');
  });
  it('rejects the development database even with different credentials and loopback aliases', () => {
    expect(() =>
      readTestEnv(
        {
          DATABASE_URL: 'postgresql://dev:secret@localhost/todo',
          TEST_DATABASE_URL:
            'postgresql://test:other@127.0.0.1:5432/todo?schema=public',
        },
        workspace(),
      ),
    ).toThrow('must differ');
  });
  it('rejects non-PostgreSQL URLs', () => {
    expect(() =>
      readTestEnv(
        { TEST_DATABASE_URL: 'https://example.com/test' },
        workspace(),
      ),
    ).toThrow('PostgreSQL URL');
  });
  it('loads a dedicated database and gives shell overrides precedence', () => {
    const directory = workspace();
    writeFileSync(
      join(directory, 'apps/api/.env'),
      'TEST_DATABASE_URL=postgresql://localhost/file_test\n',
    );
    expect(readTestEnv({}, directory).DATABASE_URL).toBe(
      'postgresql://localhost/file_test',
    );
    const env = readTestEnv(
      {
        TEST_DATABASE_URL: 'postgresql://localhost/ci_test',
        DIRECT_URL: 'postgresql://localhost/production',
      },
      directory,
    );
    expect(env.DATABASE_URL).toBe('postgresql://localhost/ci_test');
    expect(env.DIRECT_URL).toBe(env.DATABASE_URL);
    expect(env.NODE_ENV).toBe('test');
  });
});
