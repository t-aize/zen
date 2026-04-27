import { Events } from 'discord.js';

import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.shard.reconnecting');

export const shardReconnectingEvent = defineEvent(Events.ShardReconnecting, (shardId) => {
  logger.warn({ shardId }, 'Discord shard reconnecting');
});
