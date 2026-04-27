import { pingCommand } from './utilities/ping.js';
import { serverInfoCommand } from './utilities/serverInfo.js';
import { userInfoCommand } from './utilities/userInfo.js';
import { serializeCommand } from './types.js';
import type { SlashCommand } from './types.js';

export const commands = [
  pingCommand,
  serverInfoCommand,
  userInfoCommand,
] as const satisfies readonly SlashCommand[];

export const commandData = commands.map((command) => serializeCommand(command));

export const commandsByName = new Map(commands.map((command) => [command.data.name, command]));

export function getCommand(name: string): SlashCommand | undefined {
  return commandsByName.get(name);
}
