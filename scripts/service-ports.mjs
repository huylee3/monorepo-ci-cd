import { createServer } from 'node:net';

export async function assertPortAvailable(port, service) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `${service} cannot start: port ${port} on 127.0.0.1 is already in use. Stop the existing services terminal with Ctrl+C, or inspect the listener with: ss -ltnp 'sport = :${port}'`
            : `${service} port check failed: ${error.message}`,
        ),
      );
    });
    server.listen(port, '127.0.0.1', () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}
