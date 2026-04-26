import { Client, GatewayIntentBits } from 'discord.js';
import { env } from './config/env.js';
import { registerEvents } from './events/index.js';
import { createLogger } from './services/logger.js';

const logger = createLogger('bot');

export async function startBot(): Promise<Client> {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  registerEvents(client);

  client.on('error', (error) => {
    logger.error({ err: error }, 'Discord client error');
  });

  client.on('warn', (message) => {
    logger.warn({ message }, 'Discord client warning');
  });

  await client.login(env.DISCORD_TOKEN);

  return client;
}
