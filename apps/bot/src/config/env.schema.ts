import { z } from 'zod';

export const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(50),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_DEV_GUILD_ID: z.string().min(1).optional(),
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(['dev', 'prod', 'test']).default('dev'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof envSchema>;
