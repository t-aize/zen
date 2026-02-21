import { Routes } from "discord.js";
import { commands } from "@/commands/index.js";
import { defineEvent } from "@/events/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("ready");
const logDeploy = createLogger("deploy");

defineEvent({
	name: "clientReady",
	once: true,
	execute: async (client) => {
		log.info(`Logged in as ${client.user.tag} (${client.user.id})`);
		log.info(`Serving ${client.guilds.cache.size} guild(s)`);

		const body = commands.map((cmd) => cmd.data.toJSON());

		logDeploy.info(`Registering ${body.length} application command(s)...`);
		await client.rest.put(Routes.applicationCommands(client.user.id), {
			body,
		});
		logDeploy.info("Commands registered successfully.");
	},
});
