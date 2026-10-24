import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';

const execute = promisify(execFile);
export const projectRoot = resolve(import.meta.dirname, '..');

function binary(name) {
  return process.env.PG_BIN ? join(process.env.PG_BIN, name + (process.platform === 'win32' ? '.exe' : '')) : name;
}

export async function controlCluster(args) {
  const child = spawn(binary('pg_ctl'), args, { stdio: 'ignore', windowsHide: true });
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

export async function startCluster({ directory, port, database }) {
  const dir = resolve(directory);
  if (!dir.startsWith(join(projectRoot, '.local') + (process.platform === 'win32' ? '\\' : '/'))) {
    throw new Error('PostgreSQL cluster must be inside this Dashboard .local directory.');
  }
  await mkdir(dir, { recursive: true });
  const metadataPath = join(dir, 'cluster.json');
  let metadata;
  try { metadata = JSON.parse(await readFile(metadataPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { await access(join(dir, 'data', 'PG_VERSION')); throw new Error('Unowned cluster; refusing to initialize.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    metadata = { port: port ?? await freePort(), password: randomBytes(32).toString('hex'), database };
    await writeFile(metadataPath, JSON.stringify(metadata), { flag: 'wx', mode: 0o600 });
    const passwordPath = join(dir, 'init-password');
    await writeFile(passwordPath, metadata.password, { flag: 'wx', mode: 0o600 });
    await execute(binary('initdb'), ['-D', join(dir, 'data'), '-U', 'postgres', '--pwfile', passwordPath,
      '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--encoding=UTF8', '--locale=C'], { windowsHide: true });
  }
  if (await controlCluster(['-D', join(dir, 'data'), 'status']) !== 0) {
    const code = await controlCluster(['-D', join(dir, 'data'), '-l', join(dir, 'postgres.log'), '-w', 'start',
      '-o', `-h 127.0.0.1 -p ${metadata.port}`]);
    if (code !== 0) throw new Error('PostgreSQL startup failed; inspect the private cluster log.');
  }
  return {
    url: `postgresql://postgres:${metadata.password}@127.0.0.1:${metadata.port}/${metadata.database}`,
    adminUrl: `postgresql://postgres:${metadata.password}@127.0.0.1:${metadata.port}/postgres`,
    async stop() {
      if (await controlCluster(['-D', join(dir, 'data'), '-w', 'stop', '-m', 'fast']) !== 0) {
        throw new Error('PostgreSQL cleanup failed; cluster retained for retry.');
      }
    },
  };
}
