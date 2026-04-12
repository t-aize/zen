import { loadCommands } from "@zen/commands";
import { checkDatabaseConnection, closeDatabaseConnection } from "@zen/db";
import { loadEvents } from "@zen/events";
import { env } from "@zen/utils/env";
import { logger } from "@zen/utils/logger";
import { ActivityType, Client, GatewayIntentBits, Options, Partials } from "discord.js";

/**
 * Main Discord client instance.
 *
 * Configured as a **full-featured bot platform** — all gateway intents
 * and partials are enabled to support every Zen module (moderation,
 * anti-raid, tickets, music, leveling, automod, scheduled events, polls).
 *
 * ### Intents
 *
 * All non-deprecated intents are enabled. Privileged intents
 * (`GuildMembers`, `GuildPresences`, `MessageContent`) must be
 * explicitly enabled in the Discord Developer Portal under
 * **Bot → Privileged Gateway Intents**.
 *
 * ### Partials
 *
 * All partials are enabled so events fire even for uncached entities
 * (e.g. reactions on old messages, DM channels, threads joined before boot).
 * **Always check `.partial` and call `.fetch()` before accessing partial data.**
 *
 * ### Cache Sweepers
 *
 * Automatic sweepers run on a regular interval to evict stale entries
 * and keep memory usage bounded in large deployments. Entities older
 * than the configured lifetime are removed from the in-memory cache.
 *
 * ### Sharding
 *
 * Set to `"auto"` — Discord determines the optimal shard count based
 * on the bot's guild count. Override with a fixed number if you manage
 * shards externally (e.g. via a shard manager or orchestrator).
 */
const client = new Client({
	/** Let Discord determine the optimal shard count automatically. */
	shards: "auto",

	/**
	 * Time in ms to wait for guilds to become available on startup.
	 * A higher value avoids premature `guildCreate` events for guilds
	 * that are simply slow to load. 15s is safe for most deployments.
	 */
	waitGuildTimeout: 15_000,

	/**
	 * Time in ms to wait for the WebSocket to close gracefully
	 * during {@link Client.destroy}. After this, the connection is killed.
	 */
	closeTimeout: 5_000,

	/** Enable all gateway intents to support every feature across all modules. */
	intents: [
		// Guild lifecycle, channels, roles, threads
		GatewayIntentBits.Guilds,

		// Member join/leave/update — privileged (anti-raid, leveling, welcome)
		GatewayIntentBits.GuildMembers,

		// Ban/unban audit events (moderation logs)
		GatewayIntentBits.GuildModeration,

		// Emoji and sticker create/update/delete
		GatewayIntentBits.GuildExpressions,

		// Integration create/update/delete
		GatewayIntentBits.GuildIntegrations,

		// Webhook create/update/delete
		GatewayIntentBits.GuildWebhooks,

		// Invite create/delete (anti-invite, invite tracking)
		GatewayIntentBits.GuildInvites,

		// Voice state updates (music, voice activity)
		GatewayIntentBits.GuildVoiceStates,

		// Presence updates — privileged (online/offline tracking)
		GatewayIntentBits.GuildPresences,

		// Message create/update/delete in guilds (automod, XP)
		GatewayIntentBits.GuildMessages,

		// Reaction add/remove in guilds (reaction roles)
		GatewayIntentBits.GuildMessageReactions,

		// Typing start events in guilds
		GatewayIntentBits.GuildMessageTyping,

		// Message create/update/delete in DMs (ticket DM support)
		GatewayIntentBits.DirectMessages,

		// Reaction add/remove in DMs
		GatewayIntentBits.DirectMessageReactions,

		// Typing start events in DMs
		GatewayIntentBits.DirectMessageTyping,

		// Message body access — privileged (automod filters, prefix commands)
		GatewayIntentBits.MessageContent,

		// Scheduled event create/update/delete/user add/remove
		GatewayIntentBits.GuildScheduledEvents,

		// AutoMod rule create/update/delete
		GatewayIntentBits.AutoModerationConfiguration,

		// AutoMod action execution (logging triggered rules)
		GatewayIntentBits.AutoModerationExecution,

		// Poll vote add/remove in guilds
		GatewayIntentBits.GuildMessagePolls,

		// Poll vote add/remove in DMs
		GatewayIntentBits.DirectMessagePolls,
	],

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
	 * Restrict default mention parsing to prevent accidental mass-pings.
	 * `@everyone` and `@here` are **never** parsed by default.
	 */
	allowedMentions: {
		parse: ["users", "roles"],
		repliedUser: true,
	},

	/** Initial presence displayed when the bot comes online. */
	presence: {
		status: "online",
		activities: [
			{
				name: "over your servers",
				type: ActivityType.Watching,
			},
		],
	},

	/**
	 * When `true`, discord.js enforces a unique nonce on every sent message.
	 * Prevents duplicate messages if a network retry re-sends the request.
	 */
	enforceNonce: true,

	/**
	 * When `true`, API calls that reference a non-existent entity
	 * (e.g. fetching a deleted message) throw instead of returning `null`.
	 */
	failIfNotExists: false,

	/**
	 * Override default cache factories to cap collection sizes
	 * for high-volume caches. Prevents unbounded memory growth
	 * in large guilds without disabling caching entirely.
	 */
	makeCache: Options.cacheWithLimits({
		...Options.DefaultMakeCacheSettings,
		MessageManager: 200,
		PresenceManager: 0,
		ReactionManager: 100,
		GuildMemberManager: {
			maxSize: 500,
			keepOverLimit: (member) => member.id === member.client.user.id,
		},
		ThreadManager: {
			maxSize: 100,
			keepOverLimit: (thread) => !thread.archived,
		},
	}),

	/**
	 * Periodic sweepers that evict stale cache entries to free memory.
	 * Runs on configurable intervals — entities older than the lifetime
	 * threshold are removed from their respective managers.
	 */
	sweepers: {
		...Options.DefaultSweeperSettings,

		/** Sweep messages older than 30 minutes, every 5 minutes. */
		messages: {
			interval: 300,
			lifetime: 1_800,
		},

		/** Sweep threads that have been archived, every 10 minutes. */
		threads: {
			interval: 600,
			filter: () => (thread) => thread.archived ?? false,
		},

		/** Sweep guild members not in voice and without recent activity, every 15 minutes. */
		guildMembers: {
			interval: 900,
			filter: () => (member) => member.id !== member.client.user.id,
		},
	},
});

/**
 * Performs an orderly shutdown of all services.
 *
 * Execution order matters — resources are released
 * from the outermost (Discord) to the innermost (database):
 * 1. Destroy the Discord WebSocket connection.
 * 2. Close the PostgreSQL connection pool.
 *
 * @param signal - The POSIX signal that triggered the shutdown.
 */
const shutdown = async (signal: string): Promise<void> => {
	logger.info({ signal }, "Shutting down...");

	await client.destroy();
	await closeDatabaseConnection();

	logger.info("Shutdown complete");
	process.exit(0);
};

process.on("SIGINT", () => {
	void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
	void shutdown("SIGTERM");
});

process.on("unhandledRejection", (error) => {
	logger.fatal({ error }, "Unhandled promise rejection");
	process.exit(1);
});

process.on("uncaughtException", (error) => {
	logger.fatal({ error }, "Uncaught exception");
	process.exit(1);
});

/**
 * Application entry point.
 *
 * Connects to all external services in parallel where safe,
 * then authenticates with the Discord gateway. If any step
 * fails, the process exits with a fatal log.
 */
const main = async (): Promise<void> => {
	logger.info({ env: env.NODE_ENV, logLevel: env.LOG_LEVEL }, "Starting Zen...");

	// ── Load application modules and infrastructure ─────────────────

	await Promise.all([loadCommands(), loadEvents(client), checkDatabaseConnection()]);

	// ── Authenticate with the Discord gateway ────────────────────────

	await client.login(env.DISCORD_TOKEN);
};

void main().catch((error: unknown) => {
	logger.fatal({ error }, "Failed to start Zen");
	process.exit(1);
});
