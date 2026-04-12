import { commandMap } from "@zen/commands";
import { defineEvent } from "@zen/events";
import { env } from "@zen/utils/env";
import { createLogger } from "@zen/utils/logger";
import { Routes } from "discord.js";

const log = createLogger("clientReady");

/**
 * Fired once when the client has successfully connected to the
 * Discord gateway and is ready to receive events.
 *
 * Responsibilities:
 * 1. Log the authenticated bot user and guild count.
 * 2. Deploy (PUT) all registered slash commands to the Discord API.
 * 3. Report the total number of deployed commands and registered events.
 *
 * @remarks
 * Uses `strategy: "once"` because client initialization only happens once.
 * Any subsequent reconnects fire `shardResume`, not `clientReady`.
 */
defineEvent({
	name: "clientReady",
	once: true,
	execute: async (client) => {
		log.info(
			{
				user: client.user.tag,
				userId: client.user.id,
				guilds: client.guilds.cache.size,
				shards: client.ws.shards.size,
			},
			"Client is ready",
		);

		// ── Deploy slash commands ────────────────────────────────────

		const commandData = commandMap.map((cmd) => cmd.data.toJSON());

		try {
			const result = (await client.rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
				body: commandData,
			})) as unknown[];

			log.info(
				{
					deployed: result.length,
					registered: commandMap.size,
				},
				"Slash commands deployed",
			);
		} catch (error) {
			log.error({ error }, "Failed to deploy slash commands");
		}
	},
});
