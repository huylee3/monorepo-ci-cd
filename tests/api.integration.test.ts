import { afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../apps/api/src/app';
import { db } from '../apps/api/src/repositories/database';
const origin = 'http://localhost:3000',
  prefix = `test_${Date.now()}`,
  password = 'a long memorable passphrase';
const post = (
  agent: ReturnType<typeof request.agent>,
  path: string,
  data: object,
) => agent.post(path).set('Origin', origin).send(data);
afterAll(async () => {
  await db.user.deleteMany({ where: { username: { startsWith: prefix } } });
  await db.$disconnect();
});
describe('real API and PostgreSQL', () => {
  it('registers, isolates users, validates, updates, rotates, and revokes sessions', async () => {
    const a = request.agent(app),
      b = request.agent(app);
    const registration = await post(a, '/api/auth/register', {
      username: `${prefix}_a`,
      password,
    });
    expect(registration.status).toBe(201);
    expect(registration.body.user.passwordHash).toBeUndefined();
    const cookies = registration.headers['set-cookie'] as unknown as string[];
    expect(cookies.join()).toContain('HttpOnly');
    expect(cookies.join()).toContain('SameSite=Strict');
    expect(
      (
        await post(b, '/api/auth/register', {
          username: `${prefix}_b`,
          password,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post(a, '/api/auth/register', {
          username: `${prefix}_a`,
          password,
        })
      ).status,
    ).toBe(409);
    expect((await post(a, '/api/todos', { title: '' })).status).toBe(400);
    const created = await post(a, '/api/todos', {
      title: 'Ship app',
      description: 'Test it first',
    });
    expect(created.status).toBe(201);
    const id = created.body.todo.id;
    expect((await b.get('/api/todos')).body.todos).toEqual([]);
    expect(
      (
        await b
          .patch(`/api/todos/${id}`)
          .set('Origin', origin)
          .send({ completed: true })
      ).status,
    ).toBe(404);
    expect(
      (await b.delete(`/api/todos/${id}`).set('Origin', origin).send({}))
        .status,
    ).toBe(404);
    expect(
      (
        await a
          .patch(`/api/todos/${id}`)
          .set('Origin', origin)
          .send({ completed: true })
      ).body.todo.completed,
    ).toBe(true);
    expect(
      (
        await a
          .post('/api/todos')
          .set('Origin', 'https://evil.example')
          .send({ title: 'CSRF' })
      ).status,
    ).toBe(403);
    expect((await post(a, '/api/auth/refresh', {})).status).toBe(200);
    const oldRefresh = cookies
      .find((c) => c.startsWith('refresh='))!
      .split(';')[0];
    expect(
      (
        await request(app)
          .post('/api/auth/refresh')
          .set('Origin', origin)
          .set('Cookie', oldRefresh)
          .send({})
      ).status,
    ).toBe(401);
    expect((await a.get('/api/auth/me')).status).toBe(401);
    expect(
      (await post(a, '/api/auth/login', { username: `${prefix}_a`, password }))
        .status,
    ).toBe(200);
    expect(
      (await a.delete(`/api/todos/${id}`).set('Origin', origin).send({}))
        .status,
    ).toBe(204);
    expect((await post(a, '/api/auth/logout', {})).status).toBe(204);
    expect((await a.get('/api/todos')).status).toBe(401);
  });
  it('rejects weak passwords, invalid login and tampered tokens', async () => {
    const a = request.agent(app);
    expect(
      (
        await post(a, '/api/auth/register', {
          username: `${prefix}_weak`,
          password: 'short',
        })
      ).status,
    ).toBe(400);
    expect(
      (await post(a, '/api/auth/login', { username: 'nobody', password }))
        .status,
    ).toBe(401);
    expect(
      (await request(app).get('/api/todos').set('Cookie', 'access=invalid'))
        .status,
    ).toBe(401);
  });
});
