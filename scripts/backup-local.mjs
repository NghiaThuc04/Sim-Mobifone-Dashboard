import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';
import { projectRoot } from './postgres.mjs';

if (existsSync(join(projectRoot, '.env'))) loadEnvFile(join(projectRoot, '.env'));
const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
try {
  await db.connect();
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const tables = {};
  for (const table of ['users', 'auth_sessions', 'auth_login_limits', '_prisma_migrations']) {
    tables[table] = (await db.query(`SELECT * FROM "${table}"`)).rows;
  }
  for (const table of ['audit_logs', 'employee_permissions', 'commission_policies', 'employee_salaries',
    'employee_leave_records', 'employee_leave_allocations', 'carriers', 'sim_categories', 'sims',
    'sim_price_alerts', 'sim_changes', 'sim_import_batches', 'sim_removal_logs', 'customers', 'orders',
    'order_items', 'inventory_reservations', 'order_create_keys', 'order_assignment_history', 'order_status_history', 'order_completions']) {
    const present = await db.query('SELECT to_regclass($1) AS name', ['public.' + table]);
    if (present.rows[0].name) tables[table] = (await db.query(`SELECT * FROM "${table}"`)).rows;
  }
  await db.query('COMMIT');
  const directory = join(projectRoot, '.local', 'backups');
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `dashboard-logical-${Date.now()}.json`), JSON.stringify({
    format: 'dashboard-row-snapshot-v1', createdAt: new Date().toISOString(), tables,
    note: 'Private row snapshot; schema is reconstructed from versioned migrations. This is not a pg_dump archive.',
  }), { flag: 'wx', mode: 0o600 });
  console.info('Private local row snapshot written to .local/backups; no credentials printed.');
} catch {
  console.error('Local row snapshot failed; details redacted.'); process.exitCode = 1;
} finally { await db.end(); }
