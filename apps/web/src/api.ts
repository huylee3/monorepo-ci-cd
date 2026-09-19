export type User = { id: string; username: string };
export type Todo = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createApi(base = '/api', fetcher: typeof fetch = fetch) {
  let renewal: Promise<Response> | undefined;
  async function request<T>(
    path: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const headers = new Headers(options.headers);
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/json');
    const send = () =>
      fetcher(`${base}${path}`, {
        ...options,
        credentials: 'same-origin',
        headers,
      });
    let response = await send();
    if (
      response.status === 401 &&
      retry &&
      !['/auth/login', '/auth/register', '/auth/refresh'].includes(path)
    ) {
      renewal ??= fetcher(`${base}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).finally(() => {
        renewal = undefined;
      });
      if ((await renewal).ok) response = await send();
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        data && typeof data.error === 'string' ? data.error : 'Request failed',
      );
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  return { request };
}
export const api = createApi();
