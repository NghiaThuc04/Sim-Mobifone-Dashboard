import { z } from 'zod';

export const emailSchema = z.string().trim().max(254).email().transform((email) => email.toLowerCase());
export const userIdentitySchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(150),
}).strict();
export const newPasswordSchema = z.string().min(12).max(128).refine((value) => value.trim().length >= 12);
