import { eq } from "drizzle-orm";
import { db } from "@/db/index.js";
import { guilds } from "@/db/schema/index.js";
import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:guildAvailable");

defineEvent({
	name: "guildAvailable",
	once: false,
	execute: async (guild) => {
		log.debug({ guildId: guild.id, guildName: guild.name }, `Guild available: ${guild.name}`);

		try {
			const existing = await db.query.guilds.findFirst({
				where: (g, { eq }) => eq(g.id, guild.id),
			});

			if (!existing) {
				await db.insert(guilds).values({
					id: guild.id,
					name: guild.name,
					joinedAt: new Date(),
				});
				log.info({ guildId: guild.id }, "Guild row was missing — created");
				return;
			}

			if (existing.name !== guild.name) {
				await db.update(guilds).set({ name: guild.name }).where(eq(guilds.id, guild.id));
				log.info({ guildId: guild.id }, `Guild name synced: "${existing.name}" → "${guild.name}"`);
			}
		} catch (err) {
			log.error({ err, guildId: guild.id }, "Failed to verify guild row");
		}
	},
});
