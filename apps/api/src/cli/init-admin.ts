import { createInterface } from 'node:readline/promises';
import { DatabaseService } from '../database/database.service';
import { ConfigurationError, readConfig } from '../config';
import { AdminSetupError, InitAdminService } from '../users/init-admin.service';
import { readHiddenPassword } from './secret-input';

async function main() {
  const config = readConfig();
  const rotate = process.argv.includes('--rotate-password');
  let email = process.env.ADMIN_EMAIL;
  let fullName = process.env.ADMIN_FULL_NAME;
  let password = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  if (!email || (!rotate && !fullName)) {
    if (!process.stdin.isTTY) throw new AdminSetupError('Set ADMIN_EMAIL/ADMIN_FULL_NAME or run in an interactive terminal.');
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    try {
      email ??= await reader.question('Admin email: ');
      if (!rotate) fullName ??= await reader.question('Admin full name: ');
    } finally { reader.close(); }
  }
  if (password === undefined) {
    password = await readHiddenPassword('Admin password (hidden): ');
    const confirm = await readHiddenPassword('Confirm password (hidden): ');
    if (password !== confirm) throw new AdminSetupError('Passwords do not match.');
  }
  const db = new DatabaseService(config);
  try {
    const service = new InitAdminService(db);
    if (rotate) {
      await service.rotatePassword({ email, password });
      console.info('Admin password rotated.');
    } else {
      const result = await service.initialize({ email, fullName, password });
      console.info(result === 'created' ? 'Initial Admin created.' : 'Admin already initialized; no account changed.');
    }
  } finally { password = undefined; await db.$disconnect(); }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof AdminSetupError || error instanceof ConfigurationError ? error.message : 'Admin command failed; credentials redacted.');
    process.exitCode = 1;
  });
}
