import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

const discordId = (name: string) => varchar(name, { length: 32 });

export const ticketChannelTypeEnum = pgEnum("ticket_channel_type", [
	"text",
	"private_thread",
	"forum_post",
]);

export const ticketButtonStyleEnum = pgEnum("ticket_button_style", [
	"primary",
	"secondary",
	"success",
	"danger",
]);

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "closed", "archived", "deleted"]);

export const ticketOpenMethodEnum = pgEnum("ticket_open_method", [
	"panel",
	"command",
	"api",
	"automation",
	"migration",
]);

export const ticketActionEnum = pgEnum("ticket_action", [
	"opened",
	"claimed",
	"unclaimed",
	"renamed",
	"closed",
	"reopened",
	"deleted",
	"transcript_generated",
	"participant_added",
	"participant_removed",
]);

export const guildSettings = pgTable(
	"guild_settings",
	{
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		guildId: discordId("guild_id").primaryKey(),
		locale: text("locale").notNull().default("en"),
		modules: jsonb("modules").$type<Record<string, boolean>>().notNull().default({}),
		prefix: text("prefix").notNull().default("/"),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index("guild_settings_locale_idx").on(table.locale)],
);

export const ticketConfigs = pgTable(
	"ticket_configs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		logChannelId: discordId("log_channel_id"),
		transcriptChannelId: discordId("transcript_channel_id"),
		maxOpenPerUser: integer("max_open_per_user").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("ticket_configs_guild_id_uidx").on(table.guildId)],
);

export const ticketPanels = pgTable(
	"ticket_panels",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		channelId: discordId("channel_id").notNull(),
		messageId: discordId("message_id").notNull(),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("ticket_panels_guild_id_idx").on(table.guildId),
		index("ticket_panels_channel_id_idx").on(table.channelId),
		uniqueIndex("ticket_panels_message_id_uidx").on(table.messageId),
	],
);

export const ticketCategories = pgTable(
	"ticket_categories",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		emoji: varchar("emoji", { length: 64 }),
		staffRoleId: discordId("staff_role_id"),
		channelType: ticketChannelTypeEnum("channel_type").notNull().default("text"),
		parentChannelId: discordId("parent_channel_id"),
		namingTemplate: varchar("naming_template", { length: 255 })
			.notNull()
			.default("ticket-{ticketNumber}"),
		maxOpenPerUser: integer("max_open_per_user"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("ticket_categories_guild_id_idx").on(table.guildId),
		uniqueIndex("ticket_categories_guild_name_uidx").on(table.guildId, table.name),
	],
);

export const panelCategories = pgTable(
	"panel_categories",
	{
		panelId: uuid("panel_id")
			.notNull()
			.references(() => ticketPanels.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => ticketCategories.id, { onDelete: "cascade" }),
		buttonStyle: ticketButtonStyleEnum("button_style").notNull().default("primary"),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.panelId, table.categoryId] }),
		uniqueIndex("panel_categories_panel_position_uidx").on(table.panelId, table.position),
		index("panel_categories_category_id_idx").on(table.categoryId),
	],
);

export const tickets = pgTable(
	"tickets",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ticketNumber: integer("ticket_number").notNull(),
		guildId: discordId("guild_id").notNull(),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => ticketCategories.id),
		openerId: discordId("opener_id").notNull(),
		claimedById: discordId("claimed_by_id"),
		channelId: discordId("channel_id").notNull(),
		channelType: ticketChannelTypeEnum("channel_type").notNull(),
		status: ticketStatusEnum("status").notNull().default("open"),
		openMethod: ticketOpenMethodEnum("open_method").notNull().default("panel"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		closedAt: timestamp("closed_at", { withTimezone: true }),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("tickets_channel_id_uidx").on(table.channelId),
		uniqueIndex("tickets_guild_ticket_number_uidx").on(table.guildId, table.ticketNumber),
		index("tickets_category_id_idx").on(table.categoryId),
		index("tickets_guild_status_idx").on(table.guildId, table.status),
		index("tickets_opener_id_idx").on(table.openerId),
	],
);

interface TicketMessageAttachment {
	contentType: string | null;
	filename: string;
	size: number;
	url: string;
}

interface TicketMessageEmbed {
	data: Record<string, unknown>;
	type: string;
}

export const ticketMessages = pgTable(
	"ticket_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ticketId: uuid("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		discordMessageId: discordId("discord_message_id").notNull(),
		authorId: discordId("author_id").notNull(),
		authorUsername: varchar("author_username", { length: 255 }).notNull(),
		content: text("content"),
		attachments: jsonb("attachments").$type<TicketMessageAttachment[]>().notNull().default([]),
		embeds: jsonb("embeds").$type<TicketMessageEmbed[]>().notNull().default([]),
		isBot: boolean("is_bot").notNull().default(false),
		sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		uniqueIndex("ticket_messages_discord_message_id_uidx").on(table.discordMessageId),
		index("ticket_messages_ticket_id_idx").on(table.ticketId),
		index("ticket_messages_sent_at_idx").on(table.sentAt),
	],
);

export const ticketActions = pgTable(
	"ticket_actions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		ticketId: uuid("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		actorId: discordId("actor_id").notNull(),
		action: ticketActionEnum("action").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("ticket_actions_ticket_id_idx").on(table.ticketId),
		index("ticket_actions_created_at_idx").on(table.createdAt),
	],
);

export const ticketParticipants = pgTable(
	"ticket_participants",
	{
		ticketId: uuid("ticket_id")
			.notNull()
			.references(() => tickets.id, { onDelete: "cascade" }),
		userId: discordId("user_id").notNull(),
		addedById: discordId("added_by_id").notNull(),
		addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.ticketId, table.userId] }),
		index("ticket_participants_user_id_idx").on(table.userId),
	],
);

export const logConfigs = pgTable(
	"log_configs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		discordCategoryId: discordId("discord_category_id"),
		retentionDays: integer("retention_days"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("log_configs_guild_id_uidx").on(table.guildId)],
);

export const logChannelBindings = pgTable(
	"log_channel_bindings",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		logGroup: varchar("log_group", { length: 100 }).notNull(),
		discordChannelId: discordId("discord_channel_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("log_channel_bindings_guild_group_idx").on(table.guildId, table.logGroup),
		uniqueIndex("log_channel_bindings_guild_group_channel_uidx").on(
			table.guildId,
			table.logGroup,
			table.discordChannelId,
		),
	],
);

export const logEventSettings = pgTable(
	"log_event_settings",
	{
		guildId: discordId("guild_id").notNull(),
		eventType: varchar("event_type", { length: 120 }).notNull(),
		enabled: boolean("enabled").notNull().default(true),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.guildId, table.eventType] }),
		index("log_event_settings_guild_enabled_idx").on(table.guildId, table.enabled),
	],
);

export const logEntries = pgTable(
	"log_entries",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		eventType: varchar("event_type", { length: 120 }).notNull(),
		logGroup: varchar("log_group", { length: 100 }).notNull(),
		actorId: discordId("actor_id"),
		targetId: discordId("target_id"),
		targetType: varchar("target_type", { length: 100 }),
		channelId: discordId("channel_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
		discordMessageId: discordId("discord_message_id"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("log_entries_guild_created_at_idx").on(table.guildId, table.createdAt),
		index("log_entries_guild_group_created_at_idx").on(
			table.guildId,
			table.logGroup,
			table.createdAt,
		),
		index("log_entries_guild_event_type_idx").on(table.guildId, table.eventType),
		index("log_entries_expires_at_idx").on(table.expiresAt),
		uniqueIndex("log_entries_discord_message_id_uidx").on(table.discordMessageId),
	],
);

export const warnThresholds = pgTable(
	"warn_thresholds",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		warnCount: integer("warn_count").notNull(),
		actionType: varchar("action_type", { length: 64 }).notNull(),
		durationSeconds: integer("duration_seconds"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("warn_thresholds_guild_id_idx").on(table.guildId),
		uniqueIndex("warn_thresholds_guild_warn_count_uidx").on(table.guildId, table.warnCount),
	],
);

export const modCases = pgTable(
	"mod_cases",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		caseNumber: integer("case_number").notNull(),
		guildId: discordId("guild_id").notNull(),
		actionType: varchar("action_type", { length: 64 }).notNull(),
		targetId: discordId("target_id").notNull(),
		moderatorId: discordId("moderator_id"),
		reason: text("reason").notNull(),
		durationSeconds: integer("duration_seconds"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		active: boolean("active").notNull().default(true),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("mod_cases_guild_case_number_uidx").on(table.guildId, table.caseNumber),
		index("mod_cases_guild_created_at_idx").on(table.guildId, table.createdAt),
		index("mod_cases_target_id_idx").on(table.targetId),
		index("mod_cases_moderator_id_idx").on(table.moderatorId),
		index("mod_cases_active_expires_at_idx").on(table.active, table.expiresAt),
	],
);

export const automodRules = pgTable(
	"automod_rules",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		ruleType: varchar("rule_type", { length: 100 }).notNull(),
		enabled: boolean("enabled").notNull().default(true),
		actionType: varchar("action_type", { length: 64 }).notNull(),
		actionDurationSeconds: integer("action_duration_seconds"),
		config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("automod_rules_guild_rule_type_uidx").on(table.guildId, table.ruleType),
		index("automod_rules_guild_enabled_idx").on(table.guildId, table.enabled),
	],
);

export const automodExemptions = pgTable(
	"automod_exemptions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		ruleType: varchar("rule_type", { length: 100 }),
		targetType: varchar("target_type", { length: 32 }).notNull(),
		targetId: discordId("target_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("automod_exemptions_guild_id_idx").on(table.guildId),
		index("automod_exemptions_target_idx").on(table.targetType, table.targetId),
		uniqueIndex("automod_exemptions_scope_uidx").on(
			table.guildId,
			table.ruleType,
			table.targetType,
			table.targetId,
		),
	],
);

export const raidStates = pgTable(
	"raid_states",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		active: boolean("active").notNull().default(false),
		triggeredAt: timestamp("triggered_at", { withTimezone: true }),
		triggerReason: varchar("trigger_reason", { length: 255 }),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedById: discordId("resolved_by_id"),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
	},
	(table) => [
		uniqueIndex("raid_states_guild_id_uidx").on(table.guildId),
		index("raid_states_active_idx").on(table.active),
	],
);

export const automodIncidents = pgTable(
	"automod_incidents",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		guildId: discordId("guild_id").notNull(),
		ruleType: varchar("rule_type", { length: 100 }).notNull(),
		targetId: discordId("target_id").notNull(),
		channelId: discordId("channel_id"),
		actionTaken: varchar("action_taken", { length: 64 }).notNull(),
		caseId: uuid("case_id").references(() => modCases.id, { onDelete: "set null" }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("automod_incidents_guild_created_at_idx").on(table.guildId, table.createdAt),
		index("automod_incidents_rule_type_idx").on(table.ruleType),
		index("automod_incidents_target_id_idx").on(table.targetId),
		index("automod_incidents_case_id_idx").on(table.caseId),
	],
);

export const ticketPanelsRelations = relations(ticketPanels, ({ many }) => ({
	panelCategories: many(panelCategories),
}));

export const ticketCategoriesRelations = relations(ticketCategories, ({ many }) => ({
	panelCategories: many(panelCategories),
	tickets: many(tickets),
}));

export const panelCategoriesRelations = relations(panelCategories, ({ one }) => ({
	category: one(ticketCategories, {
		fields: [panelCategories.categoryId],
		references: [ticketCategories.id],
	}),
	panel: one(ticketPanels, {
		fields: [panelCategories.panelId],
		references: [ticketPanels.id],
	}),
}));

export const ticketsRelations = relations(tickets, ({ many, one }) => ({
	actions: many(ticketActions),
	category: one(ticketCategories, {
		fields: [tickets.categoryId],
		references: [ticketCategories.id],
	}),
	messages: many(ticketMessages),
	participants: many(ticketParticipants),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
	ticket: one(tickets, {
		fields: [ticketMessages.ticketId],
		references: [tickets.id],
	}),
}));

export const ticketActionsRelations = relations(ticketActions, ({ one }) => ({
	ticket: one(tickets, {
		fields: [ticketActions.ticketId],
		references: [tickets.id],
	}),
}));

export const ticketParticipantsRelations = relations(ticketParticipants, ({ one }) => ({
	ticket: one(tickets, {
		fields: [ticketParticipants.ticketId],
		references: [tickets.id],
	}),
}));

export const logConfigsRelations = relations(logConfigs, ({ many }) => ({
	channelBindings: many(logChannelBindings),
	eventSettings: many(logEventSettings),
}));

export const logChannelBindingsRelations = relations(logChannelBindings, ({ one }) => ({
	config: one(logConfigs, {
		fields: [logChannelBindings.guildId],
		references: [logConfigs.guildId],
	}),
}));

export const logEventSettingsRelations = relations(logEventSettings, ({ one }) => ({
	config: one(logConfigs, {
		fields: [logEventSettings.guildId],
		references: [logConfigs.guildId],
	}),
}));

export const modCasesRelations = relations(modCases, ({ many }) => ({
	automodIncidents: many(automodIncidents),
}));

export const automodIncidentsRelations = relations(automodIncidents, ({ one }) => ({
	case: one(modCases, {
		fields: [automodIncidents.caseId],
		references: [modCases.id],
	}),
}));
