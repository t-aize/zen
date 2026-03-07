import { logger } from "@zen/src/logger";
import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	Collection,
	type SlashCommandBuilder,
} from "discord.js";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Logical groupings for commands.
 *
 * Used for help menus, permission presets, analytics, dashboard filters,
 * and module-level enable/disable settings.
 *
 * @remarks
 * User-facing modules:
 * - `moderation`   — Ban, kick, timeout, warn, purge, slowmode, lock/unlock, etc.
 * - `automod`      — Anti-spam, anti-link, anti-invite, anti-mention spam, filters.
 * - `antiraid`     — Join-flood detection, raid mitigation, verification/quarantine.
 * - `tickets`      — Ticket panels, claim, close, reopen, archive, transcript.
 * - `music`        — Play, pause, queue, skip, stop, volume, loop, filters.
 * - `leveling`     — XP, levels, rank, leaderboard, rewards.
 * - `utility`      — Polls, reminders, embeds, translate, calculators, tools.
 * - `server`       — Server info, channel info, role info, emoji/sticker info.
 * - `user`         — User info, avatar, banner, profile, badges.
 * - `welcome`      — Welcome/goodbye messages, auto-role, onboarding flows.
 * - `roles`        — Reaction roles, role menus, self-assign roles.
 * - `giveaways`    — Giveaway creation, reroll, end, participation tools.
 * - `fun`          — Games, memes, 8ball, coinflip, casual community features.
 *
 * Admin / configuration modules:
 * - `config`       — Guild settings, module toggles, language, prefixes, defaults.
 * - `permissions`  — Command permissions, role access presets, overrides.
 * - `logging`      — Mod logs, message logs, join/leave logs, audit settings.
 * - `scheduler`    — Scheduled announcements, recurring tasks, timed automations.
 * - `custom`       — Custom commands, aliases, tag-like responses.
 * - `dashboard`    — Dashboard-linked actions, sync, diagnostics for web panel.
 *
 * Platform / owner / developer modules:
 * - `stats`        — Bot stats, usage analytics, latency, health summaries.
 * - `system`       — Shards, cache, queues, workers, runtime diagnostics.
 * - `owner`        — Owner-only commands (global config, emergency controls).
 * - `dev`          — Eval, reload, sync, debug, feature flags (development only).
 */
export type CommandCategory =
	| "moderation"
	| "automod"
	| "antiraid"
	| "tickets"
	| "music"
	| "leveling"
	| "utility"
	| "server"
	| "user"
	| "welcome"
	| "roles"
	| "giveaways"
	| "fun"
	| "config"
	| "permissions"
	| "logging"
	| "scheduler"
	| "custom"
	| "dashboard"
	| "stats"
	| "system"
	| "owner"
	| "dev";

/**
 * Represents a fully-defined slash command.
 *
 * Each command consists of:
 * - `data` — The slash command builder (name, description, options).
 * - `category` — The logical category this command belongs to (for organization).
 * - `execute` — The async function invoked when the command runs.
 * - `autocomplete` — Optional handler for autocomplete interactions.
 *
 * @example
 * ```ts
 * import { SlashCommandBuilder } from "discord.js";
 * import { defineCommand } from "@zen/commands";
 *
 * export default defineCommand({
 *   data: new SlashCommandBuilder()
 *     .setName("ping")
 *     .setDescription("Check the bot's latency"),
 *   category: "utility",
 *   async execute(interaction) {
 *     const latency = interaction.client.ws.ping;
 *     await interaction.reply(`Pong! Latency: ${latency}ms`);
 *   },
 * });
 * ```
 */
export interface Command {
	/** Slash command definition (name, description, options). */
	readonly data: SlashCommandBuilder;

	/** The category this command belongs to. */
	readonly category: CommandCategory;

	/**
	 * Executes the command logic.
	 *
	 * @param interaction - The chat input command interaction from Discord.
	 * @returns A promise that resolves when execution completes.
	 *
	 * @throws If the command fails, the error is caught by the interaction
	 * handler and logged. An ephemeral error message is sent to the user.
	 */
	readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;

	/**
	 * Handles autocomplete requests for this command.
	 *
	 * Only required if the command has options with `autocomplete: true`.
	 *
	 * @param interaction - The autocomplete interaction from Discord.
	 * @returns A promise that resolves when suggestions are sent.
	 */
	readonly autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Public read-only command map.
 *
 * Provides O(1) lookup by command name for the interaction handler
 * to route incoming interactions to the correct command.
 *
 * @example
 * ```ts
 * const cmd = commandMap.get(interaction.commandName);
 * if (cmd) await cmd.execute(interaction);
 * ```
 */
export const commandMap = new Collection<string, Readonly<Command>>();

// ─── defineCommand ───────────────────────────────────────────────────────────

/**
 * Validates and registers a command in the global registry.
 *
 * Performs the following validations:
 * 1. Command name matches the Discord-compliant pattern (1-32 lowercase, digits, `-`, `_`).
 * 2. Command description length is within 1-100 characters.
 * 3. No duplicate command names in the registry.
 * 4. Autocomplete handler exists if any option declares `autocomplete: true`.
 *
 * @param command - The command definition to register.
 * @returns The registered command (frozen to prevent mutation).
 *
 * @throws {Error} If any validation rule is violated.
 *
 * @example
 * ```ts
 * export const helpCommand = defineCommand({
 *   data: new SlashCommandBuilder()
 *     .setName("help")
 *     .setDescription("Shows help information"),
 *   category: "utility",
 *   async execute(interaction) {
 *     await interaction.reply("Here's some help!");
 *   },
 * });
 * ```
 */
export const defineCommand = (command: Command): Readonly<Command> => {
	const name = command.data.name;
	const description = command.data.description;

	// ─── Discord API Constraints ─────────────────────────────────────────────────

	/** Minimum command name length per Discord API. */
	const MIN_NAME_LENGTH = 1;

	/** Maximum command name length per Discord API. */
	const MAX_NAME_LENGTH = 32;

	/** Minimum command description length per Discord API. */
	const MIN_DESCRIPTION_LENGTH = 1;

	/** Maximum command description length per Discord API. */
	const MAX_DESCRIPTION_LENGTH = 100;

	/**
	 * Discord-compliant command name pattern.
	 *
	 * Matches 1-32 characters that are lowercase letters (Unicode-aware),
	 * digits, hyphens, or underscores. This follows the official Discord API
	 * specification for `CHAT_INPUT` command names.
	 *
	 * @see https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-naming
	 */
	const COMMAND_NAME_REGEX = /^[\p{Ll}\p{N}_-]+$/u;

	// ── Name validation ──────────────────────────────────────────────

	if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
		throw new Error(
			`Command name "${name}" must be between ${MIN_NAME_LENGTH} and ${MAX_NAME_LENGTH} characters (got ${name.length}).`,
		);
	}

	if (!COMMAND_NAME_REGEX.test(name)) {
		throw new Error(
			`Command name "${name}" contains invalid characters. ` +
				`Only lowercase letters, digits, hyphens, and underscores are allowed.`,
		);
	}

	// ── Description validation ───────────────────────────────────────

	if (description.length < MIN_DESCRIPTION_LENGTH || description.length > MAX_DESCRIPTION_LENGTH) {
		throw new Error(
			`Command "${name}" description must be between ${MIN_DESCRIPTION_LENGTH} and ${MAX_DESCRIPTION_LENGTH} characters (got ${description.length}).`,
		);
	}

	// ── Duplicate detection ──────────────────────────────────────────

	if (commandMap.has(name)) {
		throw new Error(
			`Duplicate command name "${name}". A command with this name is already registered.`,
		);
	}

	// ── Autocomplete handler presence ────────────────────────────────

	const options = "options" in command.data ? command.data.options : [];
	const hasAutocompleteOption = options.some(
		(opt) => "autocomplete" in opt && opt.autocomplete === true,
	);

	if (hasAutocompleteOption && !command.autocomplete) {
		throw new Error(
			`Command "${name}" has autocomplete options but no autocomplete handler defined.`,
		);
	}

	// ── Register & freeze ────────────────────────────────────────────

	const frozen = Object.freeze(command);
	commandMap.set(name, frozen);

	logger.debug({ command: name, category: command.category }, "Command registered");

	return frozen;
};

// ─── loadCommands ─────────────────────────────────────────────────────────────

/**
 * Dynamically imports and registers every command module.
 *
 * Each module calls {@link defineCommand} at the top level, which
 * populates {@link commandMap}. Using dynamic `import()` guarantees
 * that the registry is fully initialised before any command tries
 * to register itself — no circular-init issues.
 *
 * **Must be called once at startup**, before the client logs in.
 *
 * @returns The populated command map for convenience.
 */
export const loadCommands = async (): Promise<void> => {
	await import("@zen/commands/moderation/clear");
	await import("@zen/commands/utility/ping");

	logger.info({ commands: commandMap.size }, "Commands loaded");
};
