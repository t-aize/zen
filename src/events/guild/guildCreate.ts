import { db } from "@/db/index.js";
import { guilds } from "@/db/schema/index.js";
import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:guildCreate");

defineEvent({
	name: "guildCreate",
	once: false,
	execute: async (guild) => {
		log.info({ guildId: guild.id, guildName: guild.name }, `Joined guild: ${guild.name}`);

		try {
			await db
				.insert(guilds)
				.values({
					id: guild.id,
					name: guild.name,
					joinedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: guilds.id,
					set: { name: guild.name },
				});

			log.info({ guildId: guild.id }, "Guild row created/updated");
		} catch (err) {
			log.error({ err, guildId: guild.id }, "Failed to insert guild row");
		}
	},
});
