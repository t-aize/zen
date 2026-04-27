import 'dotenv/config';
import { z } from 'zod';

export const envSchema = z.object({
  // Application
  APP_NAME: z.string().trim().min(1).default('zen'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: z.boolean().default(true),

  // Discord runtime
  DISCORD_TOKEN: z.string().trim().min(1),
  DISCORD_CLIENT_ID: z.string().trim().min(1),

  // Development-only Discord target for guild-scoped command deployment.
  DISCORD_DEV_GUILD_ID: z.string().trim().min(1).optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsedEnv.error)}`);
}

export const env = {
  ...parsedEnv.data,
  LOG_PRETTY:
    process.env.LOG_PRETTY === undefined
      ? parsedEnv.data.NODE_ENV !== 'production'
      : parsedEnv.data.LOG_PRETTY,
};
