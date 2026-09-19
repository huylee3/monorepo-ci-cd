import { beforeEach, describe, it, expect } from 'vitest';
import { createApi } from '../../apps/web/src/api';
const base = process.env.WIREMOCK_URL ?? 'http://127.0.0.1:8080';
async function stub(
  method: string,
  url: string,
  status: number,
  jsonBody: unknown,
) {
  const r = await fetch(`${base}/__admin/mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      request: { method, url },
      response: {
        status,
        jsonBody,
        headers: { 'Content-Type': 'application/json' },
      },
    }),
  });
  if (!r.ok) throw Error('WireMock mapping failed');
}
beforeEach(async () => {
  const r = await fetch(`${base}/__admin/reset`, { method: 'POST' });
  if (!r.ok)
    throw Error(
      'WireMock reset failed; start a dedicated WireMock instance and set WIREMOCK_URL',
    );
});
describe('frontend API client against WireMock', () => {
  it('reads real HTTP responses', async () => {
    await stub('GET', '/api/todos', 200, {
      todos: [{ id: '1', title: 'Mock todo' }],
    });
    await expect(createApi(`${base}/api`).request('/todos')).resolves.toEqual({
      todos: [{ id: '1', title: 'Mock todo' }],
    });
  });
  it('surfaces API validation and outage errors', async () => {
    await stub('POST', '/api/todos', 400, { error: 'Invalid input' });
    await expect(
      createApi(`${base}/api`).request('/todos', {
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toThrow('Invalid input');
    await stub('GET', '/api/todos', 503, { error: 'Service unavailable' });
    await expect(createApi(`${base}/api`).request('/todos')).rejects.toThrow(
      'Service unavailable',
    );
  });
  it('attempts renewal once on expired sessions', async () => {
    await stub('GET', '/api/todos', 401, { error: 'Authentication required' });
    await stub('POST', '/api/auth/refresh', 401, { error: 'Session expired' });
    await expect(
      createApi(`${base}/api`).request('/todos'),
    ).rejects.toMatchObject({ status: 401 });
    const count = await fetch(`${base}/__admin/requests/count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'POST', url: '/api/auth/refresh' }),
    }).then((r) => r.json());
    expect(count.count).toBe(1);
  });

  it('renews an expired access token and retries the original request', async () => {
    for (const mapping of [
      {
        scenarioName: 'renewal',
        requiredScenarioState: 'Started',
        request: { method: 'GET', url: '/api/todos' },
        response: { status: 401, jsonBody: { error: 'Expired' } },
      },
      {
        scenarioName: 'renewal',
        requiredScenarioState: 'Started',
        newScenarioState: 'Renewed',
        request: { method: 'POST', url: '/api/auth/refresh' },
        response: { status: 200, jsonBody: { user: { id: '1' } } },
      },
      {
        scenarioName: 'renewal',
        requiredScenarioState: 'Renewed',
        request: { method: 'GET', url: '/api/todos' },
        response: { status: 200, jsonBody: { todos: [] } },
      },
    ]) {
      const response = await fetch(`${base}/__admin/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapping),
      });
      expect(response.ok).toBe(true);
    }
    await expect(createApi(`${base}/api`).request('/todos')).resolves.toEqual({
      todos: [],
    });
  });
});
