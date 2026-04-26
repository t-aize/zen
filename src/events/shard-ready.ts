import { Events } from 'discord.js';

import { createLogger } from '../services/logger.js';
import { defineEvent } from './types.js';

const logger = createLogger('events.shard-ready');

export const shardReadyEvent = defineEvent(Events.ShardReady, (shardId, unavailableGuilds) => {
  logger.info(
    {
      shardId,
      unavailableGuildCount: unavailableGuilds?.size ?? 0,
    },
    'Discord shard ready',
  );
});
