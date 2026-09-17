import { db } from './database.js';
export const todoRepository = {
  list: (userId: string) =>
    db.todo.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
  create: (userId: string, data: { title: string; description: string }) =>
    db.todo.create({ data: { ...data, userId } }),
  update: (
    userId: string,
    id: string,
    data: { title?: string; description?: string; completed?: boolean },
  ) => db.todo.updateMany({ where: { id, userId }, data }),
  find: (userId: string, id: string) =>
    db.todo.findFirst({ where: { id, userId } }),
  delete: (userId: string, id: string) =>
    db.todo.deleteMany({ where: { id, userId } }),
};
