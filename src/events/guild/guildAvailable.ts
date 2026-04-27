import { Events } from 'discord.js';

import { syncGuildCommands } from '../../commands/deployment.js';
import { createLogger } from '../../services/logger.js';
import { defineEvent } from '../types.js';

const logger = createLogger('events.guild.available');

export const guildAvailableEvent = defineEvent(Events.GuildAvailable, async (guild) => {
  try {
    await syncGuildCommands(guild);
  } catch (error) {
    logger.error({ err: error, guildId: guild.id }, 'Guild slash command sync failed');
  }
});
