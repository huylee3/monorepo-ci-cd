import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi } from '../../apps/web/src/api';
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe('frontend API client', () => {
  it('sends JSON mutations with same-origin credentials and preserves request options', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ todo: { id: '1' } }));
    const signal = new AbortController().signal;
    await expect(
      createApi('/api', fetcher).request('/todos', {
        method: 'POST',
        body: '{"title":"Ship"}',
        signal,
      }),
    ).resolves.toEqual({ todo: { id: '1' } });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/todos',
      expect.objectContaining({
        method: 'POST',
        body: '{"title":"Ship"}',
        signal,
        credentials: 'same-origin',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      }),
    );
  });
  it.each([
    new Headers({ 'X-Request-ID': 'trace' }),
    [['X-Request-ID', 'trace']] as [string, string][],
  ])('preserves all supported header representations (%#)', async (headers) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}));
    await createApi('/api', fetcher).request('/todos', { headers });
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get('X-Request-ID'),
    ).toBe('trace');
  });
  it.each([null, { error: {} }, { error: 123 }])(
    'handles malformed JSON error payloads (%#)',
    async (body) => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(body, 502));
      await expect(
        createApi('/api', fetcher).request('/todos'),
      ).rejects.toEqual(new ApiError(502, 'Request failed'));
    },
  );
  it('handles empty 204 responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      createApi('/api', fetcher).request('/todos/1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });
  it.each([400, 403, 404, 409, 429, 500])(
    'preserves HTTP %s errors without attempting renewal',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ error: 'Request rejected' }, status));
      await expect(
        createApi('/api', fetcher).request('/todos'),
      ).rejects.toMatchObject({ status, message: 'Request rejected' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('provides a fallback for non-JSON error responses', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    await expect(createApi('/api', fetcher).request('/todos')).rejects.toEqual(
      new ApiError(502, 'Request failed'),
    );
  });
  it('propagates network failures without retrying a mutation', async () => {
    const failure = new TypeError('Network unavailable');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
    await expect(
      createApi('/api', fetcher).request('/todos', { method: 'POST' }),
    ).rejects.toBe(failure);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['/auth/login', '/auth/register', '/auth/refresh'])(
    'does not recursively renew %s',
    async (path) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(json({ error: 'Unauthorized' }, 401));
      await expect(
        createApi('/api', fetcher).request(path),
      ).rejects.toMatchObject({ status: 401 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('retries a mutation once after renewal, preserving its body', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ todo: { id: '1' } }));
    await expect(
      createApi('/api', fetcher).request('/todos', {
        method: 'POST',
        body: '{"title":"Ship"}',
      }),
    ).resolves.toEqual({ todo: { id: '1' } });
    expect(fetcher.mock.calls[0]).toEqual(fetcher.mock.calls[2]);
    expect(fetcher.mock.calls[1][0]).toBe('/api/auth/refresh');
  });
  it('stops after one renewal when the retried request is still unauthorized', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({}, 401));
    await expect(
      createApi('/api', fetcher).request('/todos'),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('honors disabled renewal', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({}, 401));
    await expect(
      createApi('/api', fetcher).request('/todos', {}, false),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shares an in-flight refresh between concurrent unauthorized requests', async () => {
    let finish!: (response: Response) => void;
    let signalRefresh!: () => void;
    const started = new Promise<void>((resolve) => {
      signalRefresh = resolve;
    });
    const refresh = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    let renewed = false;
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (input === '/api/auth/refresh') {
        signalRefresh();
        return refresh;
      }
      return renewed ? json({ ok: true }) : json({}, 401);
    });
    const api = createApi('/api', fetcher);
    const first = api.request('/todos'),
      second = api.request('/auth/me');
    await started;
    renewed = true;
    finish(json({}));
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(
      fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh'),
    ).toHaveLength(1);
  });
  it('clears a failed renewal so a later request can try again', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({}, 401))
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({}))
      .mockResolvedValueOnce(json({ ok: true }));
    const api = createApi('/api', fetcher);
    await expect(api.request('/todos')).rejects.toThrow('Offline');
    await expect(api.request('/todos')).resolves.toEqual({ ok: true });
    expect(
      fetcher.mock.calls.filter(([url]) => url === '/api/auth/refresh'),
    ).toHaveLength(2);
  });
});
