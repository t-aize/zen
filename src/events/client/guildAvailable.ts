import { DEVELOPMENT_SEED_GUILD_ID, seedDevelopmentGuildData } from "@zen/db/devGuildSeed";
import { defineEvent } from "@zen/events";
import { env } from "@zen/utils/env";
import { createLogger } from "@zen/utils/logger";

const log = createLogger("guildAvailable");

const seededGuilds = new Set<string>();

defineEvent({
	name: "guildAvailable",
	execute: async (guild) => {
		if (env.NODE_ENV !== "development") return;
		if (guild.id !== DEVELOPMENT_SEED_GUILD_ID) return;
		if (seededGuilds.has(guild.id)) return;

		try {
			await seedDevelopmentGuildData(guild);
			seededGuilds.add(guild.id);
		} catch (error) {
			log.error({ error, guild: guild.id }, "Failed to apply development guild seed");
		}
	},
});
