import { Events } from 'discord.js';

import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.client.debug');

export const clientDebugEvent = defineEvent(Events.Debug, (message) => {
  logger.debug({ message }, 'Discord client debug');
});
