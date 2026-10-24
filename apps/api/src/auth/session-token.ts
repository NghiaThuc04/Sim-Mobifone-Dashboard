import { createHmac } from 'node:crypto';

export function hashSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(`session:${token}`).digest('hex');
}

export function sessionCookieName(production: boolean): string {
  return production ? '__Host-sim_dashboard_session' : 'sim_dashboard_session';
}

export function readSessionCookie(cookie: string | undefined, name: string): string | undefined {
  const values = (cookie ?? '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(name + '='));
  if (values.length !== 1) return undefined;
  const token = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
}
