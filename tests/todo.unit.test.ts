import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createTodoService } from '../apps/api/src/services/todo.service';
describe('todo service', () => {
  const repo = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    find: vi.fn(),
    delete: vi.fn(),
  };
  const service = createTodoService(repo);
  beforeEach(() => vi.resetAllMocks());
  it('does not reveal a missing or foreign todo', async () => {
    repo.update.mockResolvedValue({ count: 0 });
    await expect(
      service.update('owner', 'foreign', { completed: true }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.update).toHaveBeenCalledWith('owner', 'foreign', {
      completed: true,
    });
    expect(repo.find).not.toHaveBeenCalled();
  });
  it('requires ownership when deleting', async () => {
    repo.delete.mockResolvedValue({ count: 0 });
    await expect(service.delete('owner', 'foreign')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('returns updated todos', async () => {
    repo.update.mockResolvedValue({ count: 1 });
    repo.find.mockResolvedValue({ id: 'todo', completed: true });
    await expect(
      service.update('owner', 'todo', { completed: true }),
    ).resolves.toMatchObject({ completed: true });
  });
});

describe('todo repository failures', () => {
  it('does not read back a todo when the update fails', async () => {
    const failure = new Error('Database unavailable');
    const repo = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockRejectedValue(failure),
      find: vi.fn(),
      delete: vi.fn(),
    };
    await expect(
      createTodoService(repo).update('owner', 'todo', { title: 'New title' }),
    ).rejects.toBe(failure);
    expect(repo.find).not.toHaveBeenCalled();
  });
  it('propagates deletion failures instead of reporting success', async () => {
    const failure = new Error('Database unavailable');
    const repo = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      find: vi.fn(),
      delete: vi.fn().mockRejectedValue(failure),
    };
    await expect(createTodoService(repo).delete('owner', 'todo')).rejects.toBe(
      failure,
    );
  });
});
