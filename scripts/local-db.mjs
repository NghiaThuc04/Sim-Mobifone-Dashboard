import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { startCluster, controlCluster, projectRoot } from './postgres.mjs';

const envPath = join(projectRoot, '.env');
if (existsSync(envPath)) loadEnvFile(envPath);
const directory = join(projectRoot, '.local', 'postgres-dashboard');
if (process.argv[2] === 'stop') {
  if (await controlCluster(['-D', join(directory, 'data'), '-w', 'stop', '-m', 'fast']) !== 0) throw new Error('PostgreSQL stop failed.');
  console.info('Dashboard local PostgreSQL stopped.');
} else {
  const cluster = await startCluster({ directory, port: 55441, database: 'sim_dashboard' });
  try {
    const client = new Client({ connectionString: cluster.adminUrl });
    await client.connect();
    try {
      const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', ['sim_dashboard']);
      if (!existing.rowCount) await client.query('CREATE DATABASE sim_dashboard');
    } finally { await client.end(); }
    if (!existsSync(envPath)) {
      const metadata = JSON.parse(await readFile(join(directory, 'cluster.json'), 'utf8'));
      const values = {
        NODE_ENV: 'development', PORT: '4200', DATABASE_URL: cluster.url,
        SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_ORIGIN: 'http://127.0.0.1:3100',
        POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: metadata.password, POSTGRES_DB: metadata.database,
        PG_BIN: process.env.PG_BIN ?? '',
      };
      await writeFile(envPath, Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    }
    console.info('Dashboard local PostgreSQL ready on 127.0.0.1:55441. Existing .env is preserved.');
  } catch {
    await cluster.stop();
    throw new Error('Local database setup failed; credentials redacted.');
  }
}
