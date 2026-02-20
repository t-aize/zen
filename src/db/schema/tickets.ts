import { createId } from "@paralleldrive/cuid2";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// @ts-expect-error - TODO: Drizzle use CJS export, but we want to keep using ESM imports in our codebase
import { guilds } from "./guilds";

export const TICKET_STATUS = ["open", "closed"] as const;

export type TicketStatus = (typeof TICKET_STATUS)[number];

export const TICKET_PRIORITY = ["low", "medium", "high", "urgent"] as const;

export type TicketPriority = (typeof TICKET_PRIORITY)[number];

/**
 * Ticket config table — one row per guild.
 *
 * Stores guild-level settings for the ticket system:
 * log channel, auto-close delay, limits, and enabled state.
 * Individual ticket types (panels) are defined in `ticket_panels`.
 */
export const ticketConfig = sqliteTable(
	"ticket_config",
	{
		/** Collision-resistant unique ID (cuid2). */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Discord guild (server) snowflake ID. */
		guildId: text("guild_id")
			.notNull()
			.unique()
			.references(() => guilds.id, { onDelete: "cascade" }),

		/** Discord channel ID where ticket open/close/claim summaries are sent. Null if disabled. */
		logChannelId: text("log_channel_id"),

		/** Discord role ID that has access to all tickets (staff / support team). */
		staffRoleId: text("staff_role_id").notNull(),

		/** Maximum number of open tickets a single user can have at once across all panels. Defaults to 1. */
		maxOpenPerUser: integer("max_open_per_user").notNull().default(1),

		/** Hours of inactivity after which a ticket is automatically closed. Null to disable auto-close. */
		autoCloseHours: integer("auto_close_hours"),

		/** Whether the ticket system is enabled for this guild. */
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

		/** Unix timestamp (ms) of when this config was created. */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

		/** Unix timestamp (ms) of the last config update. */
		updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("ticket_config_guild_idx").on(table.guildId)],
);

/**
 * Ticket panels table — one row per ticket category within a guild.
 *
 * Each panel represents a type of ticket (e.g. "Support", "Bug Report", "Candidature").
 * A panel is displayed as a button in an embed. When clicked, a new ticket channel
 * is created under the configured Discord category.
 */
export const ticketPanels = sqliteTable(
	"ticket_panels",
	{
		/** Collision-resistant unique ID (cuid2). */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Discord guild (server) snowflake ID. */
		guildId: text("guild_id")
			.notNull()
			.references(() => guilds.id, { onDelete: "cascade" }),

		/** Human-readable name of this panel (e.g. "Support", "Bug Report"). */
		name: text("name").notNull(),

		/** Short description shown in the panel embed. */
		description: text("description"),

		/** Emoji displayed on the panel button (e.g. "🎫", "🐛"). */
		emoji: text("emoji"),

		/** Hex color for the panel embed (stored as integer, e.g. 0x5865F2). */
		color: integer("color"),

		/** Discord category channel ID where ticket channels for this panel are created. */
		categoryId: text("category_id").notNull(),

		/**
		 * Naming pattern for ticket channels.
		 * Supports placeholders: {number}, {username}, {panel}.
		 * Defaults to "ticket-{number}".
		 */
		namingPattern: text("naming_pattern").notNull().default("ticket-{number}"),

		/** Custom welcome message sent when a ticket of this type is opened. Supports {user}, {guild}, {panel} placeholders. */
		welcomeMessage: text("welcome_message").default(
			"Hey {user}, thanks for opening a **{panel}** ticket! A staff member will be with you shortly.",
		),

		/** Auto-incrementing counter for ticket numbers within this panel. */
		ticketCounter: integer("ticket_counter").notNull().default(0),

		/** Display order of this panel in the embed (lower = first). */
		position: integer("position").notNull().default(0),

		/** Whether this panel is currently active. Inactive panels are not shown in the embed. */
		enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),

		/** Unix timestamp (ms) of when this panel was created. */
		createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [index("ticket_panels_guild_idx").on(table.guildId)],
);

/**
 * Tickets table — one row per ticket.
 *
 * Tracks the lifecycle of each ticket: who opened it, which channel it lives in,
 * current status, priority, who claimed it, and when it was opened/closed.
 */
export const tickets = sqliteTable(
	"tickets",
	{
		/** Collision-resistant unique ID (cuid2) — used to reference a specific ticket. */
		id: text("id")
			.primaryKey()
			.$defaultFn(() => createId()),

		/** Discord guild (server) snowflake ID. */
		guildId: text("guild_id")
			.notNull()
			.references(() => guilds.id, { onDelete: "cascade" }),

		/** Reference to the panel this ticket was opened from. */
		panelId: text("panel_id")
			.notNull()
			.references(() => ticketPanels.id, { onDelete: "cascade" }),

		/** Sequential ticket number within the panel (e.g. #0001). */
		ticketNumber: integer("ticket_number").notNull(),

		/** Discord channel snowflake ID of the ticket channel. */
		channelId: text("channel_id").notNull(),

		/** Discord user snowflake ID of the member who opened the ticket. */
		userId: text("user_id").notNull(),

		/** Human-readable tag of the user at the time of opening (e.g. "User#0001"). */
		userTag: text("user_tag").notNull(),

		/** Subject / reason for opening the ticket. */
		subject: text("subject"),

		/** Current status of the ticket. */
		status: text("status", { enum: TICKET_STATUS }).notNull().default("open"),

		/** Priority level of the ticket. Null means unset. */
		priority: text("priority", { enum: TICKET_PRIORITY }),

		/** Discord user snowflake ID of the staff member who claimed the ticket. Null if unclaimed. */
		claimedBy: text("claimed_by"),

		/** Human-readable tag of the staff member who claimed the ticket. */
		claimedByTag: text("claimed_by_tag"),

		/** Discord user snowflake ID of the user who closed the ticket. Null if still open. */
		closedBy: text("closed_by"),

		/** Human-readable tag of the user who closed the ticket. */
		closedByTag: text("closed_by_tag"),

		/** Reason provided when the ticket was closed. */
		closeReason: text("close_reason"),

		/** Unix timestamp (ms) of when the ticket was opened. */
		openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull(),

		/** Unix timestamp (ms) of when the ticket was closed. Null if still open. */
		closedAt: integer("closed_at", { mode: "timestamp_ms" }),

		/** Unix timestamp (ms) of the last message activity in the ticket. Used for auto-close. */
		lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).notNull(),
	},
	(table) => [
		index("tickets_guild_idx").on(table.guildId),
		index("tickets_panel_idx").on(table.panelId),
		index("tickets_user_idx").on(table.guildId, table.userId),
		index("tickets_status_idx").on(table.guildId, table.status),
		index("tickets_channel_idx").on(table.channelId),
		index("tickets_activity_idx").on(table.status, table.lastActivityAt),
	],
);
