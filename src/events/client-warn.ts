import { Events } from 'discord.js';

import { createLogger } from '../services/logger.js';
import { defineEvent } from './types.js';

const logger = createLogger('events.client-warn');

export const clientWarnEvent = defineEvent(Events.Warn, (message) => {
  logger.warn({ message }, 'Discord client warning');
});
