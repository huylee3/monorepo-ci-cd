import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, type AppDependencies } from '../../apps/api/src/app';
import { AppError } from '../../apps/api/src/services/errors';

function application(overrides: Partial<AppDependencies> = {}) {
  return createApp({
    auth: (_req, res) => {
      res.json({ ok: true });
    },
    todos: (_req, res) => {
      res.json({ todos: [] });
    },
    ready: async () => {},
    appOrigin: 'https://daybook.example',
    environment: 'production',
    ...overrides,
  });
}

describe('HTTP boundary', () => {
  it('serves liveness independently of database availability', async () => {
    const ready = vi.fn().mockRejectedValue(new Error('database credentials'));
    const app = application({ ready });
    expect((await request(app).get('/health/live')).status).toBe(200);
    expect(ready).not.toHaveBeenCalled();
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
  });
  it('returns readiness when the database probe succeeds', async () => {
    expect((await request(application()).get('/health/ready')).status).toBe(
      200,
    );
  });
  it('sets security and cache headers', async () => {
    const response = await request(application()).get('/api/todos');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
  it.each([undefined, 'https://evil.example'])(
    'rejects mutations from an untrusted origin (%#)',
    async (origin) => {
      const call = request(application()).post('/api/todos');
      if (origin) call.set('Origin', origin);
      expect((await call.send({ title: 'Blocked' })).status).toBe(403);
    },
  );
  it('rejects non-JSON mutations', async () => {
    expect(
      (
        await request(application())
          .post('/api/todos')
          .set('Origin', 'https://daybook.example')
          .type('form')
          .send('title=Blocked')
      ).status,
    ).toBe(403);
  });
  it('accepts JSON mutations from the configured origin', async () => {
    expect(
      (
        await request(application())
          .post('/api/todos')
          .set('Origin', 'https://daybook.example')
          .send({ title: 'Allowed' })
      ).status,
    ).toBe(200);
  });
  it('returns a stable JSON error for malformed request bodies', async () => {
    const response = await request(application())
      .post('/api/todos')
      .set('Origin', 'https://daybook.example')
      .type('json')
      .send('{invalid');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid request body' });
  });
  it('limits request body size', async () => {
    const response = await request(application())
      .post('/api/todos')
      .set('Origin', 'https://daybook.example')
      .send({ title: 'x'.repeat(17000) });
    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Request too large' });
  });
  it('preserves expected application errors', async () => {
    const app = application({
      todos: () => {
        throw new AppError(404, 'Todo not found');
      },
    });
    const response = await request(app).get('/api/todos');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Todo not found' });
  });
  it.each([
    new Error('private database details'),
    { unexpected: true },
    'unexpected',
  ])('hides unexpected failures (%#)', async (failure) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = application({
      todos: (_req, _res, next) => {
        next(failure);
      },
    });
    const response = await request(app).get('/api/todos');
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
  });
  it('returns JSON for unknown routes', async () => {
    const response = await request(application()).get('/unknown');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });
});
