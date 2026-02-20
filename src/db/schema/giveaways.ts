import { createId } from "@paralleldrive/cuid2";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// @ts-expect-error - TODO: Drizzle use CJS export, but we want to keep using ESM imports in our codebase
import { guilds } from "./guilds";

export const GIVEAWAY_STATUS = ["active", "ended", "cancelled"] as const;

export type GiveawayStatus = (typeof GIVEAWAY_STATUS)[number];

/**
 * Giveaways table — one row per giveaway.
 *
 * Tracks the full lifecycle of a giveaway: creation, duration, winners,
 * requirements, and final state.
 */
export const giveaways = sqliteTable(
	"giveaways",
	{
		/** Collision-resistant unique ID (cuid2). */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Discord guild (server) snowflake ID. */
		guildId: text("guild_id")
			.notNull()
			.references(() => guilds.id, { onDelete: "cascade" }),

		/** Discord channel snowflake ID where the giveaway embed is posted. */
		channelId: text("channel_id").notNull(),

		/** Discord message snowflake ID of the giveaway embed (used for reaction tracking and editing). */
		messageId: text("message_id").notNull(),

		/** Discord user snowflake ID of the member who created the giveaway. */
		hostId: text("host_id").notNull(),

		/** Human-readable tag of the host at the time of creation. */
		hostTag: text("host_tag").notNull(),

		/** The prize description (e.g. "Nitro Classic 1 month"). */
		prize: text("prize").notNull(),

		/** Number of winners to pick when the giveaway ends. */
		winnerCount: integer("winner_count").notNull().default(1),

		/** Current status of the giveaway. */
		status: text("status", { enum: GIVEAWAY_STATUS }).notNull().default("active"),

		/** Minimum required role ID to enter. Null means no role requirement. */
		requiredRoleId: text("required_role_id"),

		/** Minimum account age in days to enter. Null means no age requirement. */
		minAccountAgeDays: integer("min_account_age_days"),

		/** Minimum server membership duration in days to enter. Null means no requirement. */
		minMemberDays: integer("min_member_days"),

		/** JSON array of Discord user snowflake IDs who won. Populated when the giveaway ends. */
		winnerIds: text("winner_ids"),

		/** Unix timestamp (ms) of when the giveaway was created. */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

		/** Unix timestamp (ms) of when the giveaway ends (or ended). */
		endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),

		/** Unix timestamp (ms) of when the giveaway actually ended. Null if still active. */
		endedAt: integer("ended_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("giveaways_guild_idx").on(table.guildId),
		index("giveaways_status_idx").on(table.status, table.endsAt),
		index("giveaways_message_idx").on(table.messageId),
		index("giveaways_channel_idx").on(table.channelId),
	],
);

/**
 * Giveaway entries table — one row per user per giveaway.
 *
 * Tracks who entered which giveaway. Prevents duplicate entries
 * and allows efficient participant counting and winner picking.
 */
export const giveawayEntries = sqliteTable(
	"giveaway_entries",
	{
		/** Collision-resistant unique ID (cuid2). */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Reference to the giveaway this entry belongs to. */
		giveawayId: text("giveaway_id")
			.notNull()
			.references(() => giveaways.id, { onDelete: "cascade" }),

		/** Discord user snowflake ID of the participant. */
		userId: text("user_id").notNull(),

		/** Unix timestamp (ms) of when the user entered. */
		enteredAt: integer("entered_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("giveaway_entries_giveaway_idx").on(table.giveawayId),
		index("giveaway_entries_user_idx").on(table.giveawayId, table.userId),
	],
);
