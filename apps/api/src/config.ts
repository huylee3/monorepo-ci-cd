import { z } from 'zod';
const env = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().default(3001),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    APP_ORIGIN: z.url().default('http://localhost:3000'),
  })
  .parse(process.env);
export const config = {
  ...env,
  secret: new TextEncoder().encode(env.JWT_SECRET),
  production: env.NODE_ENV === 'production',
};
