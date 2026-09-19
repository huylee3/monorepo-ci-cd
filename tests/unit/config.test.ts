import { describe, expect, it } from 'vitest';
import { configSchema } from '../../apps/api/src/config';

const required = {
  DATABASE_URL: 'postgresql://localhost/unit_test',
  JWT_SECRET: 'test-only-secret-with-at-least-32-characters',
};

describe('API configuration', () => {
  it('parses a valid port from the environment', () => {
    expect(configSchema.parse({ ...required, PORT: '8080' }).PORT).toBe(8080);
  });
  it.each(['0', '-1', '65536', '3.5', 'invalid', ''])(
    'rejects invalid listening ports (%s)',
    (PORT) => {
      expect(configSchema.safeParse({ ...required, PORT }).success).toBe(false);
    },
  );
  it('rejects a missing or short signing secret', () => {
    expect(
      configSchema.safeParse({ ...required, JWT_SECRET: undefined }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({ ...required, JWT_SECRET: 'short' }).success,
    ).toBe(false);
  });
});
