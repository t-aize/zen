import { Events } from 'discord.js';

import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.shard.error');

export const shardErrorEvent = defineEvent(Events.ShardError, (error, shardId) => {
  logger.error({ err: error, shardId }, 'Discord shard error');
});
