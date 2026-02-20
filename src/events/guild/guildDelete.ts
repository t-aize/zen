import { eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { guilds } from "@/db/schema/index.js";
import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:guildDelete");

defineEvent({
	name: "guildDelete",
	once: false,
	execute: async (guild) => {
		log.info({ guildId: guild.id, guildName: guild.name }, `Left guild: ${guild.name ?? guild.id}`);

		try {
			await db.delete(guilds).where(eq(guilds.id, guild.id));
			log.info({ guildId: guild.id }, "Guild row and all related data deleted (cascade)");
		} catch (err) {
			log.error({ err, guildId: guild.id }, "Failed to delete guild row");
		}
	},
});
