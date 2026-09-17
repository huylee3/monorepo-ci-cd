import { todoRepository } from '../repositories/todo.repository.js';
import { AppError } from './errors.js';
export function createTodoService(repo = todoRepository) {
  return {
    list: repo.list,
    create: repo.create,
    async update(
      userId: string,
      id: string,
      data: { title?: string; description?: string; completed?: boolean },
    ) {
      if (!(await repo.update(userId, id, data)).count)
        throw new AppError(404, 'Todo not found');
      return repo.find(userId, id);
    },
    async delete(userId: string, id: string) {
      if (!(await repo.delete(userId, id)).count)
        throw new AppError(404, 'Todo not found');
    },
  };
}
export const todoService = createTodoService();
