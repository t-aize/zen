import { Events, type Client } from 'discord.js';

import { env } from '../config/env.js';
import { createLogger } from '../services/logger.js';
import type { BotEvent } from './types.js';

const logger = createLogger('events.ready');

export const readyEvent: BotEvent<typeof Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>): void {
    logger.info(
      {
        clientId: env.DISCORD_CLIENT_ID,
        userId: client.user.id,
        username: client.user.tag,
      },
      'Discord client ready',
    );
  },
};
