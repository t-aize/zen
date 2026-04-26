import { Events } from 'discord.js';

import { createLogger } from '../services/logger.js';
import { defineEvent } from './types.js';

const logger = createLogger('events.ready');

export const readyEvent = defineEvent(
  Events.ClientReady,
  (client) => {
    const user = client.user;

    logger.info(
      {
        userId: user.id,
        username: user.tag,
        guildCount: client.guilds.cache.size,
        shardCount: client.ws.shards.size,
        readyAt: client.readyAt.toISOString(),
      },
      'Discord client ready',
    );
  },
  true,
);
