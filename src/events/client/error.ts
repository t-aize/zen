import { Events } from 'discord.js';

import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.client.error');

export const clientErrorEvent = defineEvent(Events.Error, (error) => {
  logger.error({ err: error }, 'Discord client error');
});
