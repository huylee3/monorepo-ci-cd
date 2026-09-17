import { Router, type Response } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import { authService } from '../services/auth.service.js';
import { authenticate } from '../middleware/auth.js';
const credentials = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{3,32}$/),
    password: z.string().min(15).max(128),
  })
  .strict();
function cookies(res: Response, tokens: { access: string; refresh: string }) {
  const options = {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict' as const,
    path: '/api',
  };
  res.cookie('access', tokens.access, { ...options, maxAge: 15 * 60000 });
  res.cookie('refresh', tokens.refresh, {
    ...options,
    maxAge: 7 * 86400000,
    path: '/api/auth',
  });
}
export const authController = Router();
authController.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
const limiter = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});
for (const action of ['register', 'login'] as const)
  authController.post(`/${action}`, limiter, async (req, res) => {
    const data = credentials.parse(req.body);
    const tokens = await authService[action](data.username, data.password);
    cookies(res, tokens);
    res.status(action === 'register' ? 201 : 200).json({ user: tokens.user });
  });
authController.post('/refresh', limiter, async (req, res) => {
  const tokens = await authService.refresh(req.cookies.refresh ?? '');
  cookies(res, tokens);
  res.json({ user: tokens.user });
});
authController.get('/me', authenticate, (_req, res) =>
  res.json({ user: res.locals.auth.user }),
);
authController.post('/logout', authenticate, async (_req, res) => {
  await authService.logout(res.locals.auth.sessionId);
  res.clearCookie('access', { path: '/api' });
  res.clearCookie('refresh', { path: '/api/auth' });
  res.status(204).end();
});
