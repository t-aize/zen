import { db } from "@zen/db";
import { logChannelBindings, logConfigs, logEntries, logEventSettings } from "@zen/db/schema";
import {
	type AuditLogEvent,
	ChannelType,
	type Client,
	type EmbedBuilder,
	type Guild,
	type GuildAuditLogsEntry,
	inlineCode,
	italic,
	type NonThreadGuildBasedChannel,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import type { Logger } from "pino";

export const CHANNEL_LOG_GROUP = "channels";

export const EMBED_COLOR_INFO = 0x0ea5e9;
export const EMBED_COLOR_WARN = 0xf59e0b;
export const EMBED_COLOR_ERROR = 0xef4444;

export interface ChannelLogContext {
	readonly createdAt: Date;
	readonly eventEnabled: boolean;
	readonly expiresAt: Date | null;
	readonly logChannelIds: readonly string[];
}

export interface ChannelState {
	readonly bitrate: number | null;
	readonly id: string;
	readonly name: string;
	readonly nsfw: boolean | null;
	readonly overwriteCount: number | null;
	readonly parentId: string | null;
	readonly parentName: string | null;
	readonly position: number | null;
	readonly rateLimitPerUser: number | null;
	readonly topic: string | null;
	readonly type: ChannelType;
	readonly typeLabel: string;
	readonly userLimit: number | null;
}

export const buildFooter = (text: string, avatarUrl?: string) =>
	avatarUrl ? { text, iconURL: avatarUrl } : { text };

export const formatActorLabel = (auditEntry: GuildAuditLogsEntry | null): string => {
	if (!auditEntry?.executorId) return italic("Unavailable");

	const actorParts = [`<@${auditEntry.executorId}>`, inlineCode(auditEntry.executorId)];
	if (auditEntry.executor?.username) {
		actorParts.push(italic(auditEntry.executor.username));
	}

	return actorParts.join("  •  ");
};

export const formatAuditReason = (auditEntry: GuildAuditLogsEntry | null): string => {
	if (!auditEntry?.reason) return italic("No audit reason provided");
	return inlineCode(auditEntry.reason);
};

export const formatBoolean = (value: boolean | null): string => {
	if (value === null) return italic("N/A");
	return inlineCode(value ? "Yes" : "No");
};

export const formatCount = (value: number | null, suffix = ""): string => {
	if (value === null) return italic("N/A");
	return inlineCode(`${value}${suffix}`);
};

export const formatNullableText = (value: string | null, fallback = "None"): string => {
	if (!value) return italic(fallback);
	return inlineCode(value);
};

export const getChannelTypeLabel = (type: ChannelType): string => {
	switch (type) {
		case ChannelType.GuildText:
			return "Text Channel";
		case ChannelType.GuildVoice:
			return "Voice Channel";
		case ChannelType.GuildCategory:
			return "Category";
		case ChannelType.GuildAnnouncement:
			return "Announcement Channel";
		case ChannelType.GuildStageVoice:
			return "Stage Channel";
		case ChannelType.GuildForum:
			return "Forum Channel";
		case ChannelType.GuildMedia:
			return "Media Channel";
		default:
			return "Guild Channel";
	}
};

export const getRetentionExpiry = (retentionDays: number | null): Date | null => {
	if (retentionDays === null) return null;
	return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1_000);
};

export const isGuildChannel = (channel: unknown): channel is NonThreadGuildBasedChannel =>
	typeof channel === "object" && channel !== null && "guild" in channel;

export const readChannelState = (channel: NonThreadGuildBasedChannel): ChannelState => {
	const parent =
		"parent" in channel
			? {
					parentId: channel.parent?.id ?? null,
					parentName: channel.parent?.name ?? null,
				}
			: {
					parentId: null,
					parentName: null,
				};

	return {
		bitrate: "bitrate" in channel && typeof channel.bitrate === "number" ? channel.bitrate : null,
		id: channel.id,
		name: channel.name,
		nsfw: "nsfw" in channel && typeof channel.nsfw === "boolean" ? channel.nsfw : null,
		overwriteCount:
			"permissionOverwrites" in channel ? channel.permissionOverwrites.cache.size : null,
		...parent,
		position:
			"rawPosition" in channel && typeof channel.rawPosition === "number"
				? channel.rawPosition
				: null,
		rateLimitPerUser:
			"rateLimitPerUser" in channel && typeof channel.rateLimitPerUser === "number"
				? channel.rateLimitPerUser
				: null,
		topic: "topic" in channel && typeof channel.topic === "string" ? channel.topic : null,
		type: channel.type,
		typeLabel: getChannelTypeLabel(channel.type),
		userLimit:
			"userLimit" in channel && typeof channel.userLimit === "number" ? channel.userLimit : null,
	};
};

export const fetchChannelLogContext = async (
	guildId: string,
	eventType: string,
): Promise<ChannelLogContext | null> => {
	const [config, eventSetting, bindings] = await Promise.all([
		db.query.logConfigs.findFirst({
			where: eq(logConfigs.guildId, guildId),
		}),
		db.query.logEventSettings.findFirst({
			where: and(eq(logEventSettings.guildId, guildId), eq(logEventSettings.eventType, eventType)),
		}),
		db
			.select({ discordChannelId: logChannelBindings.discordChannelId })
			.from(logChannelBindings)
			.where(
				and(
					eq(logChannelBindings.guildId, guildId),
					eq(logChannelBindings.logGroup, CHANNEL_LOG_GROUP),
				),
			),
	]);

	if (!config) {
		return null;
	}

	return {
		createdAt: new Date(),
		eventEnabled: eventSetting?.enabled ?? true,
		expiresAt: getRetentionExpiry(config.retentionDays),
		logChannelIds: bindings.map((binding) => binding.discordChannelId),
	};
};

export const fetchMatchingAuditEntry = async (
	guild: Guild,
	targetId: string,
	auditEvent: AuditLogEvent,
	logger: Logger,
): Promise<GuildAuditLogsEntry | null> => {
	const me = guild.members.me;
	if (!me?.permissions.has("ViewAuditLog")) {
		return null;
	}

	const logs = await guild.fetchAuditLogs({
		limit: 6,
		type: auditEvent,
	});

	const now = Date.now();

	for (const entry of logs.entries.values()) {
		if (entry.targetId !== targetId) continue;
		if (now - entry.createdTimestamp > 15_000) continue;

		return entry;
	}

	logger.debug({ auditEvent, guild: guild.id, targetId }, "No matching audit log entry found");

	return null;
};

export const persistChannelLogEntry = async (input: {
	readonly actorId: string | null;
	readonly channelId: string;
	readonly createdAt: Date;
	readonly discordMessageId?: string | null;
	readonly eventType: string;
	readonly expiresAt: Date | null;
	readonly guildId: string;
	readonly metadata: Record<string, unknown>;
	readonly targetId: string;
	readonly targetType: string;
}): Promise<string | null> => {
	const [created] = await db
		.insert(logEntries)
		.values({
			actorId: input.actorId,
			channelId: input.channelId,
			createdAt: input.createdAt,
			discordMessageId: input.discordMessageId ?? null,
			eventType: input.eventType,
			expiresAt: input.expiresAt,
			guildId: input.guildId,
			logGroup: CHANNEL_LOG_GROUP,
			metadata: input.metadata,
			targetId: input.targetId,
			targetType: input.targetType,
		})
		.returning({ id: logEntries.id });

	return created?.id ?? null;
};

export const updatePersistedMessageId = async (
	entryId: string,
	discordMessageId: string,
): Promise<void> => {
	await db.update(logEntries).set({ discordMessageId }).where(eq(logEntries.id, entryId));
};

export const sendChannelAuditEmbed = async (
	client: Client,
	guildId: string,
	logChannelIds: readonly string[],
	embed: EmbedBuilder,
	logger: Logger,
	logContext: string,
): Promise<string | null> => {
	if (logChannelIds.length === 0) {
		return null;
	}

	const sendResults = await Promise.allSettled(
		logChannelIds.map(async (logChannelId) => {
			const targetChannel = await client.channels.fetch(logChannelId);
			if (!targetChannel?.isSendable()) return null;
			if (!("guildId" in targetChannel) || targetChannel.guildId !== guildId) return null;

			const sentMessage = await targetChannel.send({ embeds: [embed] });
			return sentMessage.id;
		}),
	);

	for (const result of sendResults) {
		if (result.status === "fulfilled" && result.value) {
			return result.value;
		}
	}

	for (const result of sendResults) {
		if (result.status === "rejected") {
			logger.warn({ error: result.reason, guild: guildId }, logContext);
		}
	}

	return null;
};
