import { Events } from 'discord.js';

import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.shard.resume');

export const shardResumeEvent = defineEvent(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info({ shardId, replayedEvents }, 'Discord shard resumed');
});
