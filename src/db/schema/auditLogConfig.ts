import { createId } from "@paralleldrive/cuid2";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Audit log categories — each maps to a group of Discord gateway events.
 *
 * | Category   | Discord events covered                                                                                                              |
 * |------------|-------------------------------------------------------------------------------------------------------------------------------------|
 * | channel    | channelCreate, channelDelete, channelUpdate, channelPinsUpdate                                                                      |
 * |            | webhooksUpdate                                                                                                                      |
 * | thread     | threadCreate, threadDelete, threadUpdate, threadListSync                                                                            |
 * |            | threadMemberUpdate, threadMembersUpdate                                                                                             |
 * | member     | guildMemberAdd, guildMemberRemove, guildMemberUpdate, guildMemberAvailable, userUpdate                                              |
 * | role       | roleCreate, roleDelete, roleUpdate                                                                                                  |
 * | message    | messageCreate, messageDelete, messageDeleteBulk, messageUpdate                                                                      |
 * |            | messageReactionAdd, messageReactionRemove, messageReactionRemoveAll, messageReactionRemoveEmoji                                     |
 * | moderation | guildBanAdd, guildBanRemove                                                                                                         |
 * |            | autoModerationActionExecution, autoModerationRuleCreate, autoModerationRuleDelete, autoModerationRuleUpdate                         |
 * |            | Internal bot actions: warn, kick, ban, unban, mute, unmute, nickname, clear, purge                                                  |
 * | voice      | voiceStateUpdate, voiceChannelEffectSend                                                                                            |
 * |            | stageInstanceCreate, stageInstanceUpdate, stageInstanceDelete                                                                       |
 * | server     | guildCreate, guildDelete, guildUpdate, guildAvailable, guildUnavailable, guildIntegrationsUpdate                                    |
 * |            | applicationCommandPermissionsUpdate, guildAuditLogEntryCreate                                                                       |
 * |            | inviteCreate, inviteDelete                                                                                                          |
 * |            | emojiCreate, emojiDelete, emojiUpdate                                                                                               |
 * |            | stickerCreate, stickerDelete, stickerUpdate                                                                                         |
 * |            | guildSoundboardSoundCreate, guildSoundboardSoundDelete, guildSoundboardSoundUpdate, guildSoundboardSoundsUpdate, soundboardSounds    |
 * |            | guildScheduledEventCreate, guildScheduledEventUpdate, guildScheduledEventDelete                                                     |
 * |            | guildScheduledEventUserAdd, guildScheduledEventUserRemove                                                                           |
 * |            | entitlementCreate, entitlementDelete, entitlementUpdate                                                                             |
 * |            | subscriptionCreate, subscriptionDelete, subscriptionUpdate                                                                          |
 * |------------|-------------------------------------------------------------------------------------------------------------------------------------|
 * Ignored     | cacheSweep, debug, warn, error, invalidated — internal bot/shard events, not guild-relevant                                         |
 * (not logged)| clientReady, ready — lifecycle only                                                                                                 |
 * |            | shardDisconnect, shardError, shardReady, shardReconnecting, shardResume — shard-level, logged by the shard event handlers           |
 * |            | presenceUpdate, typingStart, guildMembersChunk — too noisy / no audit value                                                         |
 * |            | interactionCreate — handled by the command pipeline                                                                                 |
 * |            | webhookUpdate — deprecated alias for webhooksUpdate                                                                                 |
 * |            | ready — deprecated alias for clientReady                                                                                            |
 */
export const AUDIT_LOG_CATEGORIES = [
	"channel",
	"thread",
	"member",
	"role",
	"message",
	"moderation",
	"voice",
	"server",
] as const;

export type AuditLogCategory = (typeof AUDIT_LOG_CATEGORIES)[number];

/**
 * Audit log config table — one row per guild × category.
 *
 * Each category can be independently enabled/disabled and routed to a
 * dedicated Discord channel. A missing row means the category is unconfigured
 * (treated as disabled).
 */
export const auditLogConfig = sqliteTable(
	"audit_log_config",
	{
		/** Collision-resistant unique ID (cuid2) — used to reference a specific config row, e.g. when updating. */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Discord guild (server) snowflake ID. */
		guildId: text("guild_id").notNull(),

		/**
		 * Log category — one of the values in `AUDIT_LOG_CATEGORIES`.
		 * The pair (guildId, category) is unique, enforced by the index below.
		 */
		category: text("category", { enum: AUDIT_LOG_CATEGORIES }).notNull(),

		/** Discord channel snowflake ID where logs for this category are sent. */
		channelId: text("channel_id").notNull(),

		/**
		 * Whether this category is currently active.
		 * Defaults to true when a row is first inserted.
		 */
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

		/** Unix timestamp (ms) of when this config row was first created. */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

		/** Unix timestamp (ms) of the last update to this row. */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(t) => [
		/**
		 * Composite index on (guildId, category) — ensures uniqueness and speeds up
		 * the per-event lookup: SELECT * WHERE guild_id = ? AND category = ?
		 */
		index("audit_log_config_guild_category_idx").on(t.guildId, t.category),
	],
);
