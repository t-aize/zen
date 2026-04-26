import { Events } from 'discord.js';

import { createLogger } from '../services/logger.js';
import { defineEvent } from './types.js';

const logger = createLogger('events.shard-disconnect');

export const shardDisconnectEvent = defineEvent(Events.ShardDisconnect, (closeEvent, shardId) => {
  logger.warn(
    {
      shardId,
      code: closeEvent.code,
    },
    'Discord shard disconnected',
  );
});
