import {commandMap} from "@zen/commands";
import {defineEvent} from "@zen/events";
import {createLogger} from "@zen/src/logger";
import {
    type AutocompleteInteraction,
    blockQuote,
    bold,
    type ChatInputCommandInteraction,
    inlineCode,
    MessageFlags,
} from "discord.js";

const log = createLogger("interactionCreate");

// ─── Handlers ────────────────────────────────────────────────────────────────

/**
 * Routes a chat input (slash) command interaction to its registered handler.
 *
 * If the command is not found in the registry, an ephemeral error is sent
 * and a warning is logged. All execution errors are caught, logged,
 * and surfaced to the user as an ephemeral error message.
 */
const handleChatInputCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const command = commandMap.get(interaction.commandName);

    if (!command) {
        log.warn(
            {command: interaction.commandName, user: interaction.user.id},
            "Unknown command received",
        );

        await interaction.reply({
            content: blockQuote(
                `❌ ${bold("Unknown command")} — ${inlineCode(`/${interaction.commandName}`)} may have been removed or is not yet deployed.`,
            ),
            flags: MessageFlags.Ephemeral,
        });
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        log.error(
            {
                error,
                command: interaction.commandName,
                user: interaction.user.id,
                guild: interaction.guildId,
            },
            "Command execution failed",
        );

        const errorMessage = blockQuote(
            `⚠️ ${bold("Something went wrong")} while running ${inlineCode(`/${interaction.commandName}`)}. Please try again later.`,
        );

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: errorMessage,
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: errorMessage,
                flags: MessageFlags.Ephemeral,
            });
        }
    }
};

/**
 * Routes an autocomplete interaction to its registered handler.
 *
 * If the command or its autocomplete handler is missing, the interaction
 * is silently ignored (Discord expects no user-facing response for autocomplete).
 */
const handleAutocomplete = async (interaction: AutocompleteInteraction): Promise<void> => {
    const command = commandMap.get(interaction.commandName);

    if (!command?.autocomplete) {
        log.warn(
            {command: interaction.commandName, user: interaction.user.id},
            "Autocomplete handler not found",
        );
        return;
    }

    try {
        await command.autocomplete(interaction);
    } catch (error) {
        log.error(
            {
                error,
                command: interaction.commandName,
                user: interaction.user.id,
            },
            "Autocomplete handler failed",
        );
    }
};

// ─── Event Definition ────────────────────────────────────────────────────────

/**
 * Fired on every incoming interaction from the Discord gateway.
 *
 * Routes interactions to the appropriate handler based on type:
 * - `ChatInputCommand` → {@link handleChatInputCommand}
 * - `Autocomplete`     → {@link handleAutocomplete}
 *
 * Additional interaction types (buttons, select menus, modals, context menus)
 * can be added here as the platform grows.
 *
 * @remarks
 * Uses `strategy: "on"` because interactions are continuous and must
 * be handled for the entire lifetime of the client.
 */
defineEvent({
    name: "interactionCreate",
    execute: async (interaction) => {
        if (interaction.isChatInputCommand()) {
            await handleChatInputCommand(interaction);
            return;
        }

        if (interaction.isAutocomplete()) {
            await handleAutocomplete(interaction);
            return;
        }

        // Future: buttons, select menus, modals, context menus
    },
});
