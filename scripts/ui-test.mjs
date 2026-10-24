import { existsSync, createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { Client } from 'pg';
import { once } from 'node:events';
import { startCluster, projectRoot } from './postgres.mjs';

if (existsSync(join(projectRoot, '.env'))) loadEnvFile(join(projectRoot, '.env'));
const directory = join(projectRoot, '.local', `ui-test-${Date.now()}`);
const cluster = await startCluster({ directory, database: 'dashboard_ui_test' });
const env = { ...process.env, NODE_ENV: 'test', PORT: '4210', DATABASE_URL: cluster.url,
  SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: 'http://127.0.0.1:3110' };
const children = [];
function child(args, cwd, childEnv, log) {
  const processChild = spawn(process.execPath, args, { cwd, env: childEnv, windowsHide: true,
    stdio: ['ignore', log, log] });
  children.push(processChild);
  return processChild;
}
let stopped = false;
async function cleanup() {
  if (stopped) return;
  stopped = true;
  for (const processChild of children) {
    if (processChild.exitCode === null) {
      const finished = new Promise((resolve) => processChild.once('exit', resolve));
      processChild.kill(); await finished;
    }
  }
  await cluster.stop();
  console.info('UI fixture servers and PostgreSQL stopped.');
}
try {
  const admin = new Client({ connectionString: cluster.adminUrl });
  await admin.connect();
  try { await admin.query('CREATE DATABASE dashboard_ui_test'); } finally { await admin.end(); }
  const log = createWriteStream(join(directory, 'services.log'), { flags: 'a', mode: 0o600 });
  await once(log, 'open');
  const migrate = child(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], projectRoot, env, log);
  const code = await new Promise((resolve, reject) => { migrate.once('exit', resolve); migrate.once('error', reject); });
  if (code !== 0) throw new Error('UI test migration failed.');
  const require = createRequire(import.meta.url);
  const { DatabaseService } = require('../apps/api/dist/src/database/database.service.js');
  const { hashPassword } = require('../apps/api/dist/src/users/password.js');
  const { readConfig } = require('../apps/api/dist/src/config.js');
  const db = new DatabaseService(readConfig(env));
  const accounts = [];
  try {
    for (const role of ['ADMIN', 'STAFF']) {
      const password = randomBytes(24).toString('hex');
      const email = `ui-${role.toLowerCase()}@example.test`;
      await db.user.create({ data: { email, fullName: `UI kiểm thử ${role}`, role, passwordHash: await hashPassword(password) } });
      accounts.push({ email, password, role });
    }
    const fixtureHash = await hashPassword(randomBytes(24).toString('hex'));
    for (let index = 1; index <= 23; index++) {
      await db.user.create({ data: { email: `ui-member-${index}@example.test`, fullName: `UI kiểm thử nhân viên ${index}`,
        role: 'STAFF', status: index % 3 === 0 ? 'locked' : 'active', passwordHash: fixtureHash } });
    }
  } finally { await db.$disconnect(); }
  await writeFile(join(projectRoot, '.local', 'ui-current.json'), JSON.stringify({ accounts, url: 'http://127.0.0.1:3110', directory }), { mode: 0o600 });
  child(['apps/api/dist/src/main.js'], projectRoot, env, log);
  child([join(projectRoot, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3110'],
    join(projectRoot, 'apps/admin'), { ...env, NODE_ENV: 'production', API_INTERNAL_ORIGIN: 'http://127.0.0.1:4210' }, log);
  console.info('UI fixture starting: 127.0.0.1:3110 / API 4210; isolated test accounts stored privately. Type stop to clean up.');
  process.stdin.resume();
  process.stdin.on('data', (data) => { if (data.toString().trim() === 'stop') void cleanup().then(() => process.exit()); });
  process.on('SIGINT', () => { void cleanup().then(() => process.exit()); });
} catch {
  await cleanup();
  console.error('UI fixture failed; inspect private services.log.');
  process.exitCode = 1;
}
