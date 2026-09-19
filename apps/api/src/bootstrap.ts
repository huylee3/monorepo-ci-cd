import { createApp } from './app.js';
import { config } from './config.js';
import { db } from './repositories/database.js';
import { authController } from './controllers/auth.controller.js';
import { todoController } from './controllers/todo.controller.js';

export const app = createApp({
  auth: authController,
  todos: todoController,
  ready: () => db.$queryRaw`SELECT 1`,
  appOrigin: config.APP_ORIGIN,
  environment: config.NODE_ENV,
});
