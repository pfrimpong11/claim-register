import { z } from 'zod';

export const loginBodySchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(200),
  })
  .strict();
