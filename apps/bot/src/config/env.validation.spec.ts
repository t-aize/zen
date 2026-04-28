import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('throws when DISCORD_TOKEN is missing', () => {
    expect(() =>
      validateEnv({
        DISCORD_CLIENT_ID: '123456789012345678',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/zen?schema=public',
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
      }),
    ).toThrow(/DISCORD_TOKEN/);
  });
});
