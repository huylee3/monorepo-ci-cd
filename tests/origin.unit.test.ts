import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from '../apps/api/src/middleware/origin';
const configured = 'http://localhost:3000';
describe('CSRF origin checks', () => {
  it.each(['development', 'test', 'production'])(
    'accepts the exact configured origin in %s',
    (mode) => {
      expect(isAllowedOrigin(configured, configured, mode)).toBe(true);
    },
  );
  it('accepts both loopback aliases in development', () => {
    expect(
      isAllowedOrigin('http://127.0.0.1:3000', configured, 'development'),
    ).toBe(true);
    expect(
      isAllowedOrigin(configured, 'http://127.0.0.1:3000', 'development'),
    ).toBe(true);
  });
  it.each(['production', 'test'])(
    'keeps exact-origin enforcement in %s',
    (mode) => {
      expect(isAllowedOrigin('http://127.0.0.1:3000', configured, mode)).toBe(
        false,
      );
    },
  );
  it.each([
    undefined,
    'null',
    'invalid',
    'http://evil.example:3000',
    'http://localhost.evil.example:3000',
    'http://127.0.0.1:3001',
    'https://127.0.0.1:3000',
    'http://127.0.0.1:3000/path',
    'http://user@127.0.0.1:3000',
  ])('rejects invalid or unrelated origin %s', (origin) => {
    expect(isAllowedOrigin(origin, configured, 'development')).toBe(false);
  });
  it('does not allow loopback when the configured app is remote', () => {
    expect(
      isAllowedOrigin(
        'http://127.0.0.1:3000',
        'https://app.example',
        'development',
      ),
    ).toBe(false);
  });
});
