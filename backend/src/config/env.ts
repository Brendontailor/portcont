import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MATCH_THRESHOLD: z.coerce.number().min(0).max(100).default(95),
  REVIEW_THRESHOLD: z.coerce.number().min(0).max(100).default(85),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(15),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(600),
  JWT_SECRET: z.string().min(32).optional(),
  ADMIN_USERNAME: z.string().min(1).max(100).optional(),
  ADMIN_PASSWORD: z.string().min(8).max(200).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  cachedEnv = result.data;
  return cachedEnv;
}

export const env = getEnv();