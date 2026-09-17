import { spawn } from 'node:child_process';
import { readAppEnv, root } from './env.mjs';
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
const target = process.argv[2];
if (target && !['api', 'web'].includes(target)) {
  console.error('Usage: node scripts/dev.mjs [api|web]');
  process.exit(1);
}
const apps = target ? [`@todo/${target}`] : ['@todo/api', '@todo/web'];
for (const name of apps) {
  const child = spawn('pnpm', ['--filter', name, 'dev'], {
    cwd: root,
    env: readAppEnv(name === '@todo/api' ? 'api' : 'web'),
    stdio: 'inherit',
  });
  children.push(child);
  child.on('error', (e) => {
    console.error(e);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 1);
  });
}
