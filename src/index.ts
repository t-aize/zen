import { ActivityType, Client, GatewayIntentBits, Options, Partials, PresenceUpdateStatus, Sweepers } from "discord.js";
import { events } from "@/events/index.js";
import { env } from "@/utils/env.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("process");

const client = new Client({
	/**
	 * Privileged intents (GuildMembers, GuildPresences, MessageContent) must
	 * also be enabled in the Discord Developer Portal → Bot → Privileged
	 * Gateway Intents, otherwise the bot will fail to connect.
	 */
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildExpressions,
		GatewayIntentBits.GuildIntegrations,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildMessageTyping,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageReactions,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildScheduledEvents,
		GatewayIntentBits.AutoModerationConfiguration,
		GatewayIntentBits.AutoModerationExecution,
		GatewayIntentBits.GuildMessagePolls,
		GatewayIntentBits.DirectMessagePolls,
	],
	/**
	 * Partials allow receiving events for objects that are not fully cached
	 * (e.g. a reaction on an uncached message). Without the matching partial,
	 * Discord.js silently drops those events.
	 */
	partials: [
		Partials.User,
		Partials.Channel,
		Partials.GuildMember,
		Partials.Message,
		Partials.Reaction,
		Partials.GuildScheduledEvent,
		Partials.ThreadMember,
		Partials.SoundboardSound,
		Partials.Poll,
		Partials.PollAnswer,
	],
	/**
	 * Cap in-memory caches to avoid unbounded memory growth.
	 * Guilds and channels are kept unlimited — they are small and required
	 * everywhere. Hot-path managers are capped; presence and voice state
	 * caches are disabled entirely since this bot does not use them.
	 */
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		MessageManager: 100,
		GuildMemberManager: 200,
		UserManager: 200,
		ReactionManager: 50,
		PresenceManager: 0,
		VoiceStateManager: 0,
	}),
	/**
	 * Periodically evict stale entries to reclaim memory.
	 * All `interval` and `lifetime` values are in seconds.
	 */
	sweepers: {
		...Options.DefaultSweeperSettings,
		messages: {
			/** Evict messages older than 30 min every 5 min. */
			interval: 300,
			lifetime: 1800,
		},
		users: {
			/** Evict users idle for more than 1 hour every 30 min. */
			interval: 1800,
			filter: Sweepers.filterByLifetime({ lifetime: 3600 }),
		},
		guildMembers: {
			/** Evict guild members idle for more than 1 hour every 30 min. */
			interval: 1800,
			filter: Sweepers.filterByLifetime({ lifetime: 3600 }),
		},
	},
	/**
	 * Maximum time (ms) the WebSocket is allowed to close cleanly on shutdown.
	 * Prevents the process from hanging on SIGINT / SIGTERM.
	 */
	closeTimeout: 5_000,
	/**
	 * Time (ms) to wait for unavailable guilds to become available after the
	 * `ready` event before considering them permanently unavailable.
	 * Default is 15 000ms — kept explicit here for clarity.
	 */
	waitGuildTimeout: 15_000,
	/**
	 * Throw a DiscordAPIError when replying to an unknown interaction or
	 * editing an unknown message instead of silently swallowing the error.
	 * Keeping this `true` surfaces bugs early in development.
	 */
	failIfNotExists: true,
	/**
	 * Enforce unique nonces on messages to prevent duplicate sends caused by
	 * network retries. Strongly recommended in production.
	 */
	enforceNonce: true,
	/**
	 * Shard configuration. "auto" lets Discord tell the bot how many shards
	 * it needs based on guild count — switch to a numeric value or array
	 * only if running a custom sharding setup.
	 */
	shards: "auto",
	/**
	 * Initial presence broadcast as soon as the bot comes online.
	 * Can be updated at runtime via `client.user.setPresence()`.
	 * `status`     — one of online | idle | dnd | invisible
	 * `activities` — array of activities shown under the bot's username
	 */
	presence: {
		status: PresenceUpdateStatus.Online,
		activities: [
			{
				name: "🪐 the universe",
				type: ActivityType.Watching,
			},
		],
	},
});

/**
 * Main entry point — loads all commands and events, binds listeners to the
 * client, then establishes the WebSocket connection to Discord.
 *
 * Keeping this in an explicit `main` function ensures every async operation
 * is properly awaited and errors bubble up to the top-level handler cleanly.
 */
const main = async () => {
	// Dynamically import the registries so every `defineCommand` and
	// `defineEvent` call runs before the client starts binding listeners.
	await import("@/commands/registry.js");
	await import("@/events/registry.js");

	/** Bind every registered event handler to the client. */
	for (const event of events) {
		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args));
		} else {
			client.on(event.name, (...args) => event.execute(...args));
		}
	}

	await client.login(env.DISCORD_TOKEN);
};

/**
 * Graceful shutdown — destroy the WebSocket connection cleanly before exiting
 * so Discord marks the bot as offline immediately rather than waiting for a timeout.
 */
const shutdown = async (signal: string) => {
	const log = createLogger("shutdown");
	log.info(`Received ${signal}, shutting down gracefully...`);
	await client.destroy();
	process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/** Surface unhandled async rejections as structured log entries instead of crashing silently. */
process.on("unhandledRejection", (reason) => log.error({ err: reason }, "Unhandled rejection"));

/** Catch synchronous exceptions that escaped all try/catch blocks. */
process.on("uncaughtException", (error) => {
	log.error({ err: error }, "Uncaught exception");
	process.exit(1);
});

await main();
