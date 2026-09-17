import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { root } from './env.mjs';
import { assertPortAvailable } from './service-ports.mjs';
mkdirSync(resolve(root, '.local'), { recursive: true });
const pg = new EmbeddedPostgres({
  databaseDir: resolve(root, '.local/postgres'),
  user: 'todo',
  password: 'local-development-only',
  port: 55432,
  persistent: true,
  authMethod: 'scram-sha-256',
  postgresFlags: ['-h', '127.0.0.1'],
});
let wiremock;
let stopping = false;
let databaseStarted = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  wiremock?.kill('SIGTERM');
  if (databaseStarted) await pg.stop().catch(() => {});
  process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => void stop());
try {
  await assertPortAvailable(8080, 'WireMock');
  await assertPortAvailable(55432, 'PostgreSQL');
  const version = '3.13.2',
    jar = resolve(root, `.local/wiremock-${version}.jar`);
  if (!existsSync(jar)) {
    console.log('Downloading WireMock standalone…');
    const url = `https://repo.maven.apache.org/maven2/org/wiremock/wiremock-standalone/${version}/wiremock-standalone-${version}.jar`;
    const response = await fetch(url);
    if (!response.ok)
      throw Error(`WireMock download failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer()),
      checksum = await fetch(`${url}.sha256`);
    if (
      !checksum.ok ||
      createHash('sha256').update(bytes).digest('hex') !==
        (await checksum.text()).trim()
    )
      throw Error('WireMock checksum verification failed');
    writeFileSync(`${jar}.tmp`, bytes);
    renameSync(`${jar}.tmp`, jar);
  }
  if (!existsSync(resolve(root, '.local/postgres/PG_VERSION')))
    await pg.initialise();
  await pg.start();
  databaseStarted = true;
  const client = pg.getPgClient();
  await client.connect();
  for (const database of ['todo', 'todo_test'])
    if (
      !(
        await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [
          database,
        ])
      ).rowCount
    )
      await client.query(`CREATE DATABASE ${database}`);
  await client.end();
  wiremock = spawn(
    'java',
    [
      '-jar',
      jar,
      '--port',
      '8080',
      '--bind-address',
      '127.0.0.1',
      '--disable-banner',
    ],
    { stdio: 'inherit' },
  );
  wiremock.on('error', (e) => {
    console.error(e.message);
    void stop(1);
  });
  wiremock.on('exit', (code) => {
    if (!stopping) void stop(code || 1);
  });
  const deadline = Date.now() + 30_000;
  let ready = false;
  while (!ready && Date.now() < deadline && !stopping) {
    try {
      const response = await fetch('http://127.0.0.1:8080/__admin/health', {
        signal: AbortSignal.timeout(1000),
      });
      ready = response.ok;
    } catch {
      /* The JVM may still be starting. */
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready)
    throw new Error('WireMock did not become ready within 30 seconds.');
  console.log(
    'PostgreSQL: 127.0.0.1:55432 (todo, todo_test). WireMock: 127.0.0.1:8080. Ctrl+C stops both.',
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  await stop(1);
}
