import { createId } from "@paralleldrive/cuid2";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const warnings = sqliteTable("warnings", {
	/** Collision-resistant unique ID (cuid2) — used to reference a specific warning. */
	id: text("id")
		.primaryKey()
		.$defaultFn(() => createId()),

	/** Guild (server) snowflake ID this warning belongs to. */
	guildId: text("guild_id").notNull(),

	/** Discord user snowflake ID of the warned member. */
	userId: text("user_id").notNull(),

	/** Discord user snowflake ID of the moderator who issued the warning. */
	moderatorId: text("moderator_id").notNull(),

	/** Human-readable tag of the moderator at the time of the warning (e.g. "Mod#0001"). */
	moderatorTag: text("moderator_tag").notNull(),

	/** Reason for the warning, as provided by the moderator. */
	reason: text("reason").notNull(),

	/** Unix timestamp (ms) of when the warning was issued. */
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
