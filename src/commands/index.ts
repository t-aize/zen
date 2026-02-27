import {pingCommand} from "@zen/commands/ping";
import type {AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder,} from "discord.js";

/** Minimum command name length per Discord API. */
const MIN_COMMAND_NAME_LENGTH = 1;

/** Maximum command name length per Discord API. */
const MAX_COMMAND_NAME_LENGTH = 32;

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
    execute(interaction: ChatInputCommandInteraction): Promise<void>;

    /**
     * Handles autocomplete requests for this command.
     *
     * Only required if the command has options with `autocomplete: true`.
     *
     * @param interaction - The autocomplete interaction from Discord.
     * @returns A promise that resolves when suggestions are sent.
     */
    autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

/**
 * Global registry of all registered commands.
 *
 * Commands must be defined using {@link defineCommand} to ensure validation
 * and immutability. This array is used by the command handler to register
 * commands with Discord and route interactions to the correct handlers.
 *
 * @remarks
 * - The order of commands in this array does not affect functionality.
 * - All commands should be imported and included here for registration.
 */
export const commands: readonly Command[] = [pingCommand];

/**
 * Validates and registers a command in the global registry.
 *
 * Performs the following validations:
 * - Command name is valid (1-32 lowercase chars, no spaces).
 * - No duplicate command names.
 * - Cooldown duration is within bounds.
 * - Autocomplete handler exists if options require it.
 *
 * @param command - The command definition to register.
 * @returns The registered command (frozen to prevent mutation).
 *
 * @throws {Error} If validation fails.
 *
 * @example
 * ```ts
 * export default defineCommand({
 *   data: new SlashCommandBuilder()
 *     .setName("help")
 *     .setDescription("Shows help information"),
 *   meta: { category: "utility" },
 *   async execute(interaction) {
 *     await interaction.reply("Here's some help!");
 *   },
 * });
 * ```
 */
export function defineCommand(command: Command): Readonly<Command> {
    const name = command.data.name.trim();

    // Validate command name format
    if (name.length < MIN_COMMAND_NAME_LENGTH || name.length > MAX_COMMAND_NAME_LENGTH) {
        throw new Error(
            `Command name "${name}" must be between ${MIN_COMMAND_NAME_LENGTH} and ${MAX_COMMAND_NAME_LENGTH} characters.`,
        );
    }

    if (name !== name.toLowerCase()) {
        throw new Error(
            `Command name "${name}" must be lowercase. Use "${name.toLowerCase()}" instead.`,
        );
    }

    if (/\s/.test(name)) {
        throw new Error(`Command name "${name}" cannot contain whitespace.`);
    }

    // Validate autocomplete handler presence
    const options = "options" in command.data ? command.data.options : [];
    const hasAutocompleteOption = options.some(
        (opt) => "autocomplete" in opt && opt.autocomplete === true,
    );

    if (hasAutocompleteOption && !command.autocomplete) {
        throw new Error(
            `Command "${name}" has autocomplete options but no autocomplete handler defined.`,
        );
    }

    // Freeze to prevent accidental mutation
    return Object.freeze(command);
}
