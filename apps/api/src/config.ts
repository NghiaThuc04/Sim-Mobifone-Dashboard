import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4200),
  DATABASE_URL: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return ['postgres:', 'postgresql:'].includes(url.protocol) && !!url.hostname && url.pathname.length > 1;
    } catch { return false; }
  }),
  SESSION_SECRET: z.string().min(32).refine((value) => !/REPLACE|CHANGE_ME/i.test(value)),
  FRONTEND_ORIGIN: z.string().refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value && !url.username && !url.password;
    } catch { return false; }
  }),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(28800),
  LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  LOGIN_IP_MAX: z.coerce.number().int().min(1).max(1000).default(30),
  LOGIN_ACCOUNT_MAX: z.coerce.number().int().min(1).max(100).default(10),
  INTERNAL_ORDER_CREATION_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
});

export type ApiConfig = z.infer<typeof configSchema>;
export const APP_CONFIG = Symbol('APP_CONFIG');
export class ConfigurationError extends Error {}

export function readConfig(input: NodeJS.ProcessEnv = process.env): ApiConfig {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new ConfigurationError(`Invalid environment: ${fields.join(', ')}. Check .env.example; values are redacted.`);
  }
  if (result.data.NODE_ENV === 'production' && !result.data.FRONTEND_ORIGIN.startsWith('https://')) {
    throw new ConfigurationError('FRONTEND_ORIGIN must use HTTPS in production.');
  }
  if (result.data.NODE_ENV === 'production' && result.data.INTERNAL_ORDER_CREATION_ENABLED) {
    throw new ConfigurationError('Internal test order creation cannot be enabled in production.');
  }
  return result.data;
}
