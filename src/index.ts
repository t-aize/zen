import "dotenv/config";

import process from "node:process";
import { env } from "@zen/utils/env";
import { logger } from "@zen/utils/logger";
import { Client, GatewayIntentBits, Partials } from "discord.js";

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.MessageContent,
	],
	partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.once("ready", (c) => {
	logger.info(
		{ guilds: c.guilds.cache.size, user: c.user.tag },
		"Zen is online",
	);
});

async function shutdown(signal: string): Promise<void> {
	logger.info({ signal }, "Shutting down...");

	client.destroy();

	logger.info("Shutdown complete");
	process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (error) => {
	logger.fatal({ error }, "Unhandled rejection");
	process.exit(1);
});

process.on("uncaughtException", (error) => {
	logger.fatal({ error }, "Uncaught exception");
	process.exit(1);
});

async function main(): Promise<void> {
	logger.info(
		{ env: env.NODE_ENV, logLevel: env.LOG_LEVEL },
		"Starting Zen...",
	);

	await client.login(env.DISCORD_TOKEN);
}

main().catch((error) => {
	logger.fatal({ error }, "Failed to start Zen");
	process.exit(1);
});
