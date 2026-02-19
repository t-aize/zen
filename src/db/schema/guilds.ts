import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Guilds table — one row per Discord server the bot has joined.
 * Used to store per-guild configuration and settings.
 */
export const guilds = sqliteTable("guilds", {
	/** Discord guild (server) snowflake ID — primary key. */
	id: text("id").primaryKey(),

	/** Human-readable guild name, kept in sync on guildCreate / guildUpdate. */
	name: text("name").notNull(),

	/** Unix timestamp (seconds) of when the bot joined this guild. */
	joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
});
