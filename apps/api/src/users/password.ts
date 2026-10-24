import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { newPasswordSchema } from './user-input';

const parameters = { N: 65536, r: 8, p: 2, maxmem: 96 * 1024 * 1024 };
const prefix = '$scrypt$v1$65536$8$2$';

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, parameters, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  newPasswordSchema.parse(password);
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${prefix}${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 128 ||
    !/^\$scrypt\$v1\$65536\$8\$2\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(encoded)) return false;
  const parts = encoded.slice(prefix.length).split('$');
  const salt = Buffer.from(parts[0], 'base64url');
  const expected = Buffer.from(parts[1], 'base64url');
  return timingSafeEqual(await derive(password, salt), expected);
}
