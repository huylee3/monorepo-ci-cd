import { db } from './database.js';
export const authRepository = {
  byUsername: (username: string) => db.user.findUnique({ where: { username } }),
  createUser: (username: string, passwordHash: string) =>
    db.user.create({ data: { username, passwordHash } }),
  createSession: (userId: string, refreshHash: string, expiresAt: Date) =>
    db.session.create({ data: { userId, refreshHash, expiresAt } }),
  session: (id: string) =>
    db.session.findUnique({ where: { id }, include: { user: true } }),
  async rotate(id: string, oldHash: string, newHash: string) {
    return db.session.updateMany({
      where: {
        id,
        refreshHash: oldHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { refreshHash: newHash },
    });
  },
  revoke: (id: string) =>
    db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
};
