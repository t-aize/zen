import { createId } from "@paralleldrive/cuid2";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// @ts-expect-error - TODO: Drizzle use CJS export, but we want to keep using ESM imports in our codebase
import { guilds } from "./guilds";

/**
 * Notes table — internal staff memos on users.
 *
 * Notes are not sanctions — they are invisible to the target user.
 * Staff can add, list, and remove notes on any member.
 */
export const notes = sqliteTable(
	"notes",
	{
		/** Collision-resistant unique ID (cuid2). */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Discord guild (server) snowflake ID. */
		guildId: text("guild_id")
			.notNull()
			.references(() => guilds.id, { onDelete: "cascade" }),

		/** Discord user snowflake ID of the member the note is about. */
		userId: text("user_id").notNull(),

		/** Discord user snowflake ID of the moderator who wrote the note. */
		moderatorId: text("moderator_id").notNull(),

		/** Human-readable tag of the moderator at the time of writing. */
		moderatorTag: text("moderator_tag").notNull(),

		/** The note content. */
		content: text("content").notNull(),

		/** Unix timestamp (ms) of when the note was created. */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("notes_guild_user_idx").on(table.guildId, table.userId)],
);
