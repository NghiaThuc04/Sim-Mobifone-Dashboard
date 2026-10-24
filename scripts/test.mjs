import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { startCluster, projectRoot } from './postgres.mjs';

if (existsSync(join(projectRoot, '.env'))) loadEnvFile(join(projectRoot, '.env'));
const cluster = await startCluster({ directory: join(projectRoot, '.local', `test-${Date.now()}`), database: 'dashboard_test' });
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: cluster.url,
  SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: 'http://127.0.0.1:3100' };
async function run(args) {
  const child = spawn(process.execPath, args, { cwd: projectRoot, env, stdio: 'inherit', windowsHide: true });
  return new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code) => resolve(code ?? 1)); });
}
try {
  const client = new Client({ connectionString: cluster.adminUrl });
  await client.connect();
  try { await client.query('CREATE DATABASE dashboard_test'); } finally { await client.end(); }
  if (existsSync(join(projectRoot, 'apps/api/prisma/migrations'))) {
    const code = await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts']);
    if (code !== 0) throw new Error('Test migration failed.');
  }
  process.exitCode = await run(['--test', '--test-concurrency=1', 'apps/api/dist/test/*.test.js']);
} finally { await cluster.stop(); }
