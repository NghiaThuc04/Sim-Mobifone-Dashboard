import { z } from 'zod';

export const monthSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
export function currentMonth() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
}
export function monthBounds(month: string) {
  const [year, number] = month.split('-').map(Number);
  const from = new Date(0); from.setUTCFullYear(year, number - 1, 1);
  const until = new Date(0); until.setUTCFullYear(year, number, 1);
  return { from: new Date(from.getTime() - 7 * 3600000), until: new Date(until.getTime() - 7 * 3600000) };
}
