import type { AutocompleteInteraction, ChatInputCommandInteraction, SharedSlashCommand } from "discord.js";
import { Collection } from "discord.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("commands");

/**
 * Shape of every slash command registered in the bot.
 * Extend this interface to add shared fields like `cooldown`, `ownerOnly`, etc.
 */
export interface Command {
	/** Builder instance that describes the command to Discord's API. */
	data: SharedSlashCommand;

	/**
	 * Handler called by the interaction router when a user invokes this command.
	 * Must always return a resolved or rejected Promise so errors are caught
	 * uniformly by the caller.
	 */
	execute: (interaction: ChatInputCommandInteraction) => Promise<void>;

	/**
	 * Optional autocomplete handler. When defined, the interaction router will
	 * call this instead of a hardcoded per-command branch.
	 */
	autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

/**
 * Central registry that holds every command registered via `defineCommand`.
 * Import this collection in the interaction handler and the deploy routine.
 */
export const commands = new Collection<string, Command>();

/**
 * Defines a slash command, runs safety checks, and registers it in the
 * central collection. Assign the return value to a named export so the
 * registry can import it explicitly — this makes it impossible to forget
 * to register a command.
 *
 * Safety checks performed at registration time:
 * - `data.name` must be non-empty (Discord requirement: 1–32 chars, lowercase)
 * - `data.description` must be non-empty
 * - Duplicate command names throw immediately so mis-wiring is caught on boot
 *
 * @example
 * export const ping = defineCommand({
 *   data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),
 *   execute: async (interaction) => {
 *     await interaction.reply("🏓 Pong!");
 *   },
 * });
 */
export const defineCommand = (command: Command): Command => {
	const name = command.data.name;
	const description = command.data.description;

	if (!name || name.trim().length === 0) {
		throw new Error("defineCommand: command name must not be empty");
	}

	if (!description || description.trim().length === 0) {
		throw new Error(`defineCommand: command "/${name}" must have a description`);
	}

	if (commands.has(name)) {
		throw new Error(`defineCommand: duplicate command name "/${name}" — each command name must be unique`);
	}

	commands.set(name, command);
	log.debug(`Registered command /${name}`);

	return command;
};
