import { DiscordAPIError } from "discord.js";
import { commands } from "@/commands/index.js";
import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("interaction");

defineEvent({
	name: "interactionCreate",
	once: false,
	execute: async (interaction) => {
		if (!interaction.isChatInputCommand()) return;

		const { commandName, user, guildId, channelId } = interaction;

		const command = commands.get(commandName);

		if (!command) {
			log.warn({ commandName, userId: user.id, guildId }, `Unknown command: /${commandName}`);
			await interaction.reply({ content: "Unknown command.", ephemeral: true });
			return;
		}

		log.debug({ commandName, userId: user.id, guildId, channelId }, `${user.tag} used /${commandName}`);

		try {
			await command.execute(interaction);
		} catch (error) {
			if (error instanceof DiscordAPIError) {
				log.error(
					{ err: error, code: error.code, status: error.status, commandName },
					`Discord API error while executing /${commandName}`,
				);
			} else {
				log.error({ err: error, commandName, userId: user.id }, `Failed to execute /${commandName}`);
			}

			const payload = {
				content: "An error occurred while executing this command.",
				ephemeral: true,
			};

			try {
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp(payload);
				} else {
					await interaction.reply(payload);
				}
			} catch {
				// Interaction may have expired — nothing to do
			}
		}
	},
});
