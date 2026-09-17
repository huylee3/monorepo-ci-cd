import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { todoService } from '../services/todo.service.js';
const fields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  completed: z.boolean(),
};
const create = z
  .object({ title: fields.title, description: fields.description.default('') })
  .strict();
const update = z
  .object(fields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const todoController = Router();
todoController.use(authenticate);
todoController.get('/', async (_req, res) =>
  res.json({ todos: await todoService.list(res.locals.auth.user.id) }),
);
todoController.post('/', async (req, res) =>
  res.status(201).json({
    todo: await todoService.create(
      res.locals.auth.user.id,
      create.parse(req.body),
    ),
  }),
);
todoController.patch('/:id', async (req, res) =>
  res.json({
    todo: await todoService.update(
      res.locals.auth.user.id,
      z.uuid().parse(req.params.id),
      update.parse(req.body),
    ),
  }),
);
todoController.delete('/:id', async (req, res) => {
  await todoService.delete(
    res.locals.auth.user.id,
    z.uuid().parse(req.params.id),
  );
  res.status(204).end();
});
