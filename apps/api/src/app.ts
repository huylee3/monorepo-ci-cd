import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { isAllowedOrigin } from './middleware/origin.js';
import { errorHandler } from './middleware/errors.js';

export interface AppDependencies {
  auth: RequestHandler;
  todos: RequestHandler;
  ready: () => Promise<unknown>;
  appOrigin: string;
  environment: string;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!isAllowedOrigin(
        req.get('origin'),
        dependencies.appOrigin,
        dependencies.environment,
      ) ||
        !req.is('application/json'))
    ) {
      res.status(403).json({ error: 'Invaliddd request origin or content type' });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }), cookieParser());
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await dependencies.ready();
    } catch {
      res.status(503).json({ status: 'unavailable' });
      return;
    }
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', dependencies.auth);
  app.use('/api/todos', dependencies.todos);
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
