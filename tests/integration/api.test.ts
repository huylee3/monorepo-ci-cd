import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/api/src/bootstrap';
import { db } from '../../apps/api/src/repositories/database';

const origin = 'http://localhost:3000';
const password = 'a long memorable passphrase';
const usernames: string[] = [];
const post = (
  agent: ReturnType<typeof request.agent>,
  path: string,
  data: object,
) => agent.post(path).set('Origin', origin).send(data);

async function registeredUser() {
  const username = `test_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  usernames.push(username);
  const agent = request.agent(app);
  const response = await post(agent, '/api/auth/register', {
    username,
    password,
  });
  expect(response.status).toBe(201);
  return { agent, username, response };
}

afterEach(async () => {
  await db.user.deleteMany({
    where: { username: { in: usernames.splice(0) } },
  });
});
afterAll(async () => {
  await db.$disconnect();
});

describe('authentication with PostgreSQL', () => {
  it('registers with private cookies and excludes password hashes', async () => {
    const { agent, username, response } = await registeredUser();
    expect(response.body.user).toEqual({ id: expect.any(String), username });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) {
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Strict');
    }
    expect(
      (await post(agent, '/api/auth/register', { username, password })).status,
    ).toBe(409);
  });
  it('rotates refresh credentials and revokes a session on token reuse', async () => {
    const { agent, response } = await registeredUser();
    const cookies = response.headers['set-cookie'] as unknown as string[];
    const refresh = cookies
      .find((cookie) => cookie.startsWith('refresh='))!
      .split(';')[0];
    expect((await post(agent, '/api/auth/refresh', {})).status).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/auth/refresh')
          .set('Origin', origin)
          .set('Cookie', refresh)
          .send({})
      ).status,
    ).toBe(401);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
  it('logs in again and invalidates the session on logout', async () => {
    const { agent, username } = await registeredUser();
    expect((await post(agent, '/api/auth/logout', {})).status).toBe(204);
    expect((await agent.get('/api/todos')).status).toBe(401);
    expect(
      (await post(agent, '/api/auth/login', { username, password })).status,
    ).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.username).toBe(username);
  });
  it('rejects weak passwords, invalid login and tampered tokens', async () => {
    const agent = request.agent(app);
    expect(
      (
        await post(agent, '/api/auth/register', {
          username: 'weak',
          password: 'short',
        })
      ).status,
    ).toBe(400);
    expect(
      (await post(agent, '/api/auth/login', { username: 'nobody', password }))
        .status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/todos').set('Cookie', 'access=invalid'))
        .status,
    ).toBe(401);
  });
});

describe('todos with PostgreSQL', () => {
  it('creates, updates, lists and deletes an owned todo', async () => {
    const { agent } = await registeredUser();
    const created = await post(agent, '/api/todos', {
      title: 'Ship app',
      description: 'Test it first',
    });
    expect(created.status).toBe(201);
    const id = created.body.todo.id;
    const updated = await agent
      .patch(`/api/todos/${id}`)
      .set('Origin', origin)
      .send({ completed: true });
    expect(updated.status).toBe(200);
    expect(updated.body.todo.completed).toBe(true);
    expect((await agent.get('/api/todos')).body.todos).toEqual([
      updated.body.todo,
    ]);
    expect(
      (await agent.delete(`/api/todos/${id}`).set('Origin', origin).send({}))
        .status,
    ).toBe(204);
    expect((await agent.get('/api/todos')).body.todos).toEqual([]);
  });
  it('prevents another user from reading, editing or deleting a todo', async () => {
    const owner = await registeredUser();
    const other = await registeredUser();
    const created = await post(owner.agent, '/api/todos', { title: 'Private' });
    expect(created.status).toBe(201);
    const path = `/api/todos/${created.body.todo.id}`;
    expect((await other.agent.get('/api/todos')).body.todos).toEqual([]);
    expect(
      (
        await other.agent
          .patch(path)
          .set('Origin', origin)
          .send({ completed: true })
      ).status,
    ).toBe(404);
    expect(
      (await other.agent.delete(path).set('Origin', origin).send({})).status,
    ).toBe(404);
    expect((await owner.agent.get('/api/todos')).body.todos).toEqual([
      created.body.todo,
    ]);
  });
  it('rejects invalid input and foreign origins without creating todos', async () => {
    const { agent } = await registeredUser();
    expect((await post(agent, '/api/todos', { title: '' })).status).toBe(400);
    expect(
      (
        await agent
          .post('/api/todos')
          .set('Origin', 'https://evil.example')
          .send({ title: 'CSRF' })
      ).status,
    ).toBe(403);
    expect((await agent.get('/api/todos')).body.todos).toEqual([]);
  });
});
