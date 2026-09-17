import argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { Prisma } from '@prisma/client';
import { config } from '../config.js';
import { authRepository as repo } from '../repositories/auth.repository.js';
import { AppError } from './errors.js';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
const dummyHash = argon2.hash(randomBytes(32), passwordOptions);
const publicUser = (u: { id: string; username: string }) => ({
  id: u.id,
  username: u.username,
});
async function access(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('todo-api')
    .setAudience('todo-web')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(config.secret);
}
async function session(user: { id: string; username: string }) {
  const token = randomBytes(32).toString('base64url');
  const s = await repo.createSession(
    user.id,
    hash(token),
    new Date(Date.now() + 7 * 86400000),
  );
  return {
    user: publicUser(user),
    access: await access(user.id, s.id),
    refresh: `${s.id}.${token}`,
  };
}
export const authService = {
  async register(username: string, password: string) {
    try {
      return await session(
        await repo.createUser(
          username,
          await argon2.hash(password, passwordOptions),
        ),
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new AppError(409, 'Username unavailable');
      throw e;
    }
  },
  async login(username: string, password: string) {
    const u = await repo.byUsername(username);
    const valid = await argon2.verify(
      u?.passwordHash ?? (await dummyHash),
      password,
    );
    if (!u || !valid) throw new AppError(401, 'Invalid username or password');
    return session(u);
  },
  async authenticate(token: string) {
    try {
      const { payload } = await jwtVerify(token, config.secret, {
        algorithms: ['HS256'],
        issuer: 'todo-api',
        audience: 'todo-web',
      });
      if (typeof payload.sid !== 'string' || !payload.sub) throw Error();
      const s = await repo.session(payload.sid);
      if (
        !s ||
        s.revokedAt ||
        s.expiresAt <= new Date() ||
        s.userId !== payload.sub
      )
        throw Error();
      return { user: publicUser(s.user), sessionId: s.id };
    } catch {
      throw new AppError(401, 'Authentication required');
    }
  },
  async refresh(value: string) {
    const [id, token] = value.split('.');
    if (!id || !token) throw new AppError(401, 'Invalid session');
    const s = await repo.session(id);
    if (!s || s.revokedAt || s.expiresAt <= new Date())
      throw new AppError(401, 'Session expired');
    const next = randomBytes(32).toString('base64url');
    if (!(await repo.rotate(id, hash(token), hash(next))).count) {
      await repo.revoke(id);
      throw new AppError(401, 'Session expired');
    }
    return {
      user: publicUser(s.user),
      access: await access(s.userId, id),
      refresh: `${id}.${next}`,
    };
  },
  logout: repo.revoke,
};
