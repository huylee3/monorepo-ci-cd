import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { config } from './config.js';
import { isAllowedOrigin } from './middleware/origin.js';
import { db } from './repositories/database.js';
import { authController } from './controllers/auth.controller.js';
import { todoController } from './controllers/todo.controller.js';
import { AppError } from './services/errors.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '16kb' }), cookieParser());
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    (!isAllowedOrigin(req.get('origin'), config.APP_ORIGIN, config.NODE_ENV) ||
      !req.is('application/json'))
  ) {
    res.status(403).json({ error: 'Invalid request origin or content type' });
    return;
  }
  next();
});
app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ status: 'ok' });
});
app.use('/api/auth', authController);
app.use('/api/todos', todoController);
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Invalid input',
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  const status =
    err instanceof AppError
      ? err.status
      : err.status === 400
        ? 400
        : err.status === 413
          ? 413
          : 500;
  if (status === 500)
    console.error(
      'Request failed',
      err instanceof Error ? err.message : 'Unknown error',
    );
  res.status(status).json({
    error:
      status === 500
        ? 'Internal server error'
        : status === 413
          ? 'Request too large'
          : err.message,
  });
};
app.use(errors);
