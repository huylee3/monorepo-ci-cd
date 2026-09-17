import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const incoming = new URL(request.url);
        const target = new URL(
          incoming.pathname + incoming.search,
          process.env.API_URL ?? 'http://127.0.0.1:3001',
        );
        const headers = new Headers(request.headers);
        headers.delete('host');
        headers.delete('connection');
        try {
          const upstream = await fetch(target, {
            method: request.method,
            headers,
            body: ['GET', 'HEAD'].includes(request.method)
              ? undefined
              : await request.arrayBuffer(),
            redirect: 'manual',
          });
          const output = new Headers(upstream.headers);
          output.delete('set-cookie');
          for (const cookie of upstream.headers.getSetCookie())
            output.append('set-cookie', cookie);
          return new Response(upstream.body, {
            status: upstream.status,
            headers: output,
          });
        } catch {
          return Response.json(
            { error: 'Service unavailable' },
            { status: 502 },
          );
        }
      },
    },
  },
});
