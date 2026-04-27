import type { ApplicationCommand, Guild } from 'discord.js';

import { env } from '../config/env.js';
import { createLogger } from '../services/logger.js';
import { commandData } from './index.js';

const logger = createLogger('commands.deployment');
const syncedGuildIds = new Set<string>();

type ComparableApplicationCommand = Parameters<ApplicationCommand['equals']>[0];

function commandsMatch(remoteCommands: readonly ApplicationCommand[]): boolean {
  if (remoteCommands.length !== commandData.length) {
    return false;
  }

  return commandData.every((command) => {
    const remoteCommand = remoteCommands.find((candidate) => candidate.name === command.name);

    return remoteCommand?.equals(command as ComparableApplicationCommand, true) ?? false;
  });
}

export async function syncGuildCommands(guild: Guild): Promise<void> {
  if (env.DISCORD_DEV_GUILD_ID !== undefined && guild.id !== env.DISCORD_DEV_GUILD_ID) {
    return;
  }

  if (syncedGuildIds.has(guild.id)) {
    return;
  }

  const remoteCommands = [...(await guild.commands.fetch()).values()];

  if (commandsMatch(remoteCommands)) {
    syncedGuildIds.add(guild.id);
    logger.debug(
      { guildId: guild.id, count: commandData.length },
      'Guild slash commands already up to date',
    );
    return;
  }

  await guild.commands.set(commandData);
  syncedGuildIds.add(guild.id);

  logger.info({ guildId: guild.id, count: commandData.length }, 'Guild slash commands deployed');
}
