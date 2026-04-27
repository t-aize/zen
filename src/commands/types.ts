import type {
  AutocompleteInteraction,
  Awaitable,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface SlashCommand {
  data: SlashCommandData;

  execute(interaction: ChatInputCommandInteraction): Awaitable<void>;
  autocomplete?(interaction: AutocompleteInteraction): Awaitable<void>;
}

export function defineSlashCommand(command: SlashCommand): SlashCommand {
  return command;
}

export function serializeCommand(
  command: SlashCommand,
): RESTPostAPIChatInputApplicationCommandsJSONBody {
  const data = command.data.toJSON();

  return {
    ...data,
    contexts: data.contexts,
  };
}
