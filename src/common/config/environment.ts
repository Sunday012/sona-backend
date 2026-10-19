import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(32),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  TRUSTED_HOSTS: z.string().default('localhost,127.0.0.1'),
});

export type Environment = z.infer<typeof schema>;

export function validateEnvironment(input: Record<string, unknown>): Environment {
  const env = schema.parse(input);
  if (env.NODE_ENV === 'production') {
    const insecureDatabase =
      !env.DATABASE_URL.includes('sslmode=require') && !env.DATABASE_URL.includes('sslmode=verify-full');
    const insecureRedis = !env.REDIS_URL.startsWith('rediss://');
    if (insecureDatabase || insecureRedis) {
      throw new Error('Production requires TLS for PostgreSQL and Redis');
    }
    if (env.JWT_ACCESS_SECRET.includes('change-me') || env.JWT_REFRESH_SECRET.includes('change-me')) {
      throw new Error('Production cannot start with placeholder secrets');
    }
  }
  return env;
}
