import { createHash, createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { repo, passwords } = vi.hoisted(() => ({
  repo: {
    byUsername: vi.fn(),
    createUser: vi.fn(),
    createSession: vi.fn(),
    session: vi.fn(),
    rotate: vi.fn(),
    revoke: vi.fn(),
  },
  passwords: {
    argon2id: 2,
    hash: vi.fn().mockResolvedValue('hashed-password'),
    verify: vi.fn(),
  },
}));
vi.mock('../../apps/api/src/repositories/auth.repository.js', () => ({
  authRepository: repo,
}));
const { argonPath } = await vi.hoisted(async () => {
  const { createRequire } = await import('node:module');
  return {
    argonPath: createRequire(
      new URL('../../apps/api/package.json', import.meta.url),
    ).resolve('argon2'),
  };
});
vi.mock(argonPath, () => ({ default: passwords }));
import { authService } from '../../apps/api/src/services/auth.service';

const user = { id: 'user-1', username: 'alice', passwordHash: 'stored-hash' };
const session = () => ({
  id: 'session-1',
  userId: user.id,
  user,
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
});
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
// Construct signed fixtures independently of the production JWT issuer.
function jwt(
  claims: Record<string, unknown> = {},
  secret = process.env.JWT_SECRET!,
  algorithm = 'HS256',
) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode({ alg: algorithm })}.${encode({ sub: user.id, sid: 'session-1', iss: 'todo-api', aud: 'todo-web', exp: Math.floor(Date.now() / 1000) + 60, ...claims })}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}
beforeEach(() => {
  vi.clearAllMocks();
  repo.byUsername.mockResolvedValue(user);
  repo.createUser.mockResolvedValue(user);
  repo.createSession.mockResolvedValue({ id: 'session-1' });
  repo.session.mockResolvedValue(session());
  repo.rotate.mockResolvedValue({ count: 1 });
  repo.revoke.mockResolvedValue({ count: 1 });
  passwords.hash.mockResolvedValue('hashed-password');
  passwords.verify.mockResolvedValue(true);
});

describe('registration and login', () => {
  it('hashes passwords using Argon2id before storing the user', async () => {
    const result = await authService.register(
      'alice',
      'a long test passphrase',
    );
    expect(passwords.hash).toHaveBeenCalledWith('a long test passphrase', {
      type: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    expect(repo.createUser).toHaveBeenCalledWith('alice', 'hashed-password');
    expect(result.user).toEqual({ id: user.id, username: 'alice' });
  });
  it('stores only the refresh token hash and sets a seven-day session lifetime', async () => {
    const before = Date.now();
    const result = await authService.login('alice', 'password');
    const token = result.refresh.split('.')[1];
    expect(repo.createSession).toHaveBeenCalledWith(
      user.id,
      digest(token),
      expect.any(Date),
    );
    const expiry = repo.createSession.mock.calls[0][2].getTime();
    expect(expiry).toBeGreaterThanOrEqual(before + 7 * 86400000);
    expect(expiry).toBeLessThanOrEqual(Date.now() + 7 * 86400000);
    expect(result.user).not.toHaveProperty('passwordHash');
    const payload = JSON.parse(
      Buffer.from(result.access.split('.')[1], 'base64url').toString(),
    );
    expect(payload).toMatchObject({
      sub: user.id,
      sid: 'session-1',
      iss: 'todo-api',
      aud: 'todo-web',
    });
    expect(payload.exp - payload.iat).toBe(900);
  });
  it('uses the same error for missing users and wrong passwords, without creating sessions', async () => {
    passwords.verify.mockResolvedValue(false);
    await expect(authService.login('alice', 'wrong')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password',
    });
    repo.byUsername.mockResolvedValue(null);
    await expect(authService.login('missing', 'wrong')).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password',
    });
    expect(passwords.verify).toHaveBeenLastCalledWith(
      'hashed-password',
      'wrong',
    );
    expect(repo.createSession).not.toHaveBeenCalled();
  });
  it('does not authenticate a missing user even if the password verifier returns true', async () => {
    repo.byUsername.mockResolvedValue(null);
    await expect(
      authService.login('missing', 'password'),
    ).rejects.toMatchObject({ status: 401 });
    expect(repo.createSession).not.toHaveBeenCalled();
  });
  it('propagates storage failures instead of issuing a session', async () => {
    const failure = new Error('database unavailable');
    repo.createUser.mockRejectedValueOnce(failure);
    await expect(authService.register('alice', 'password')).rejects.toBe(
      failure,
    );
    expect(repo.createSession).not.toHaveBeenCalled();
  });
});

describe('access token authentication', () => {
  it('propagates database outages instead of treating them as invalid credentials', async () => {
    const failure = new Error('Database unavailable');
    repo.session.mockRejectedValueOnce(failure);
    await expect(authService.authenticate(jwt())).rejects.toBe(failure);
  });
  it('accepts a valid JWT only with an active matching session', async () => {
    await expect(authService.authenticate(jwt())).resolves.toEqual({
      user: { id: user.id, username: 'alice' },
      sessionId: 'session-1',
    });
    expect(repo.session).toHaveBeenCalledWith('session-1');
  });
  it.each([
    ['expired', { exp: 1 }],
    ['wrong issuer', { iss: 'other-api' }],
    ['wrong audience', { aud: 'other-web' }],
    ['missing subject', { sub: undefined }],
    ['missing session', { sid: undefined }],
    ['invalid session type', { sid: 123 }],
  ])('rejects %s claims before looking up a session', async (_name, claims) => {
    await expect(authService.authenticate(jwt(claims))).rejects.toMatchObject({
      status: 401,
    });
    expect(repo.session).not.toHaveBeenCalled();
  });
  it.each([
    '',
    'not-a-jwt',
    jwt({}, 'wrong-secret'),
    jwt({}, undefined, 'HS512'),
  ])('rejects malformed or incorrectly signed tokens (%#)', async (token) => {
    await expect(authService.authenticate(token)).rejects.toMatchObject({
      status: 401,
    });
    expect(repo.session).not.toHaveBeenCalled();
  });
  it.each(['missing', 'revoked', 'expired', 'wrong owner'])(
    'rejects a %s database session',
    async (kind) => {
      repo.session.mockResolvedValue(
        kind === 'missing'
          ? null
          : {
              ...session(),
              ...(kind === 'revoked'
                ? { revokedAt: new Date() }
                : kind === 'expired'
                  ? { expiresAt: new Date(0) }
                  : { userId: 'another-user' }),
            },
      );
      await expect(authService.authenticate(jwt())).rejects.toMatchObject({
        status: 401,
      });
    },
  );
});

describe('refresh and logout', () => {
  it.each(['', 'session-only', '.token', 'session.', 'session.token.extra'])(
    'rejects malformed refresh credentials (%#)',
    async (value) => {
      await expect(authService.refresh(value)).rejects.toMatchObject({
        status: 401,
      });
      expect(repo.session).not.toHaveBeenCalled();
      expect(repo.rotate).not.toHaveBeenCalled();
    },
  );
  it.each(['missing', 'revoked', 'expired'])(
    'never rotates a %s session',
    async (kind) => {
      repo.session.mockResolvedValue(
        kind === 'missing'
          ? null
          : {
              ...session(),
              ...(kind === 'revoked'
                ? { revokedAt: new Date() }
                : { expiresAt: new Date(0) }),
            },
      );
      await expect(
        authService.refresh('session-1.old-token'),
      ).rejects.toMatchObject({ status: 401 });
      expect(repo.rotate).not.toHaveBeenCalled();
    },
  );
  it('rotates the token using hashes and issues a usable access token', async () => {
    const result = await authService.refresh('session-1.old-token');
    expect(result.refresh).not.toBe('session-1.old-token');
    expect(repo.rotate).toHaveBeenCalledWith(
      'session-1',
      digest('old-token'),
      digest(result.refresh.split('.')[1]),
    );
    await expect(
      authService.authenticate(result.access),
    ).resolves.toMatchObject({ sessionId: 'session-1' });
    expect(repo.revoke).not.toHaveBeenCalled();
  });
  it('revokes the session when atomic rotation detects token reuse', async () => {
    repo.rotate.mockResolvedValue({ count: 0 });
    await expect(
      authService.refresh('session-1.old-token'),
    ).rejects.toMatchObject({ status: 401 });
    expect(repo.revoke).toHaveBeenCalledWith('session-1');
  });
  it('revokes the requested session on logout', async () => {
    await authService.logout('session-1');
    expect(repo.revoke).toHaveBeenCalledWith('session-1');
  });
});
