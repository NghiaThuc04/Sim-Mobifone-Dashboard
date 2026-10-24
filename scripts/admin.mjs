import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const mode = process.argv[2];
if (!['dev', 'start'].includes(mode)) throw new Error('Admin launcher requires dev or start.');
if (existsSync(resolve(root, '.env'))) loadEnvFile(resolve(root, '.env'));
// Load env in this wrapper so Next does not propagate an unsupported env-file flag into child NODE_OPTIONS.
const child = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), mode,
  '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: resolve(root, 'apps/admin'), stdio: 'inherit', windowsHide: true,
  env: { ...process.env, NODE_ENV: mode === 'start' ? 'production' : 'development' },
});
child.once('error', () => { console.error('Admin process failed to start.'); process.exitCode = 1; });
child.once('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal); });
