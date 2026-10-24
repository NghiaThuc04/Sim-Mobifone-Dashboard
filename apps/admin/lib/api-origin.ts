import 'server-only';

export function apiOrigin(): string {
  const value = process.env.API_INTERNAL_ORIGIN ?? 'http://127.0.0.1:4200';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) {
    throw new Error('Invalid API_INTERNAL_ORIGIN configuration.');
  }
  return value;
}
