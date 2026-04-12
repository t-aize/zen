import { db } from "@zen/db";
import { logChannelBindings, logConfigs, logEntries, logEventSettings } from "@zen/db/schema";
import { defineEvent } from "@zen/events";
import { createLogger } from "@zen/utils/logger";
import {
	AuditLogEvent,
	blockQuote,
	bold,
	ChannelType,
	EmbedBuilder,
	type GuildAuditLogsEntry,
	type GuildBasedChannel,
	inlineCode,
	italic,
	time,
	TimestampStyles,
} from "discord.js";
import { and, eq } from "drizzle-orm";

const log = createLogger("channelCreate");

const EVENT_TYPE = "channel_create";
const LOG_GROUP = "channels";

const EMBED_COLOR_INFO = 0x0ea5e9;
const EMBED_COLOR_WARN = 0xf59e0b;

type ChannelCreateAuditEntry =
	| GuildAuditLogsEntry<AuditLogEvent.ChannelCreate>
	| GuildAuditLogsEntry<AuditLogEvent.ThreadCreate>;

interface ChannelAuditSnapshot {
	readonly archiveDurationMinutes: number | null;
	readonly auditEntry: ChannelCreateAuditEntry | null;
	readonly bitrate: number | null;
	readonly createdAt: Date;
	readonly discordMessageId: string | null;
	readonly eventEnabled: boolean;
	readonly expiresAt: Date | null;
	readonly logChannelIds: readonly string[];
	readonly nsfw: boolean | null;
	readonly overwriteCount: number | null;
	readonly parentId: string | null;
	readonly parentName: string | null;
	readonly position: number | null;
	readonly rateLimitPerUser: number | null;
	readonly topic: string | null;
	readonly userLimit: number | null;
}

const buildFooter = (text: string, avatarUrl?: string) =>
	avatarUrl ? { text, iconURL: avatarUrl } : { text };

const formatBoolean = (value: boolean | null): string => {
	if (value === null) return italic("N/A");
	return inlineCode(value ? "Yes" : "No");
};

const formatCount = (value: number | null, suffix = ""): string => {
	if (value === null) return italic("N/A");
	return inlineCode(`${value}${suffix}`);
};

const formatNullableText = (value: string | null, fallback = "None"): string => {
	if (!value) return italic(fallback);
	return inlineCode(value);
};

const formatActorLabel = (auditEntry: ChannelCreateAuditEntry | null): string => {
	if (!auditEntry?.executorId) return italic("Unavailable");

	const actorParts = [`<@${auditEntry.executorId}>`, inlineCode(auditEntry.executorId)];
	if (auditEntry.executor?.username) {
		actorParts.push(italic(auditEntry.executor.username));
	}

	return actorParts.join("  •  ");
};

const formatAuditReason = (auditEntry: ChannelCreateAuditEntry | null): string => {
	if (!auditEntry?.reason) return italic("No audit reason provided");
	return inlineCode(auditEntry.reason);
};

const getAuditLogEvent = (channel: GuildBasedChannel): AuditLogEvent => {
	return channel.isThread() ? AuditLogEvent.ThreadCreate : AuditLogEvent.ChannelCreate;
};

const getArchiveDurationMinutes = (channel: GuildBasedChannel): number | null => {
	return "autoArchiveDuration" in channel && typeof channel.autoArchiveDuration === "number"
		? channel.autoArchiveDuration
		: null;
};

const getBitrate = (channel: GuildBasedChannel): number | null => {
	return "bitrate" in channel && typeof channel.bitrate === "number" ? channel.bitrate : null;
};

const getNsfw = (channel: GuildBasedChannel): boolean | null => {
	return "nsfw" in channel && typeof channel.nsfw === "boolean" ? channel.nsfw : null;
};

const getOverwriteCount = (channel: GuildBasedChannel): number | null => {
	return "permissionOverwrites" in channel ? channel.permissionOverwrites.cache.size : null;
};

const getParentInfo = (
	channel: GuildBasedChannel,
): { parentId: string | null; parentName: string | null } => {
	if (!("parent" in channel)) {
		return { parentId: null, parentName: null };
	}

	return {
		parentId: channel.parent?.id ?? null,
		parentName: channel.parent?.name ?? null,
	};
};

const getPosition = (channel: GuildBasedChannel): number | null => {
	return "rawPosition" in channel && typeof channel.rawPosition === "number"
		? channel.rawPosition
		: null;
};

const getRateLimitPerUser = (channel: GuildBasedChannel): number | null => {
	return "rateLimitPerUser" in channel && typeof channel.rateLimitPerUser === "number"
		? channel.rateLimitPerUser
		: null;
};

const getTopic = (channel: GuildBasedChannel): string | null => {
	return "topic" in channel && typeof channel.topic === "string" ? channel.topic : null;
};

const getUserLimit = (channel: GuildBasedChannel): number | null => {
	return "userLimit" in channel && typeof channel.userLimit === "number" ? channel.userLimit : null;
};

const getChannelTypeLabel = (type: ChannelType): string => {
	switch (type) {
		case ChannelType.GuildText:
			return "Text Channel";
		case ChannelType.GuildVoice:
			return "Voice Channel";
		case ChannelType.GuildCategory:
			return "Category";
		case ChannelType.GuildAnnouncement:
			return "Announcement Channel";
		case ChannelType.AnnouncementThread:
			return "Announcement Thread";
		case ChannelType.PublicThread:
			return "Public Thread";
		case ChannelType.PrivateThread:
			return "Private Thread";
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

const getTargetType = (channel: GuildBasedChannel): string => {
	return channel.isThread() ? "thread" : "channel";
};

const getRetentionExpiry = (retentionDays: number | null): Date | null => {
	if (retentionDays === null) return null;
	return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1_000);
};

const fetchMatchingAuditEntry = async (
	channel: GuildBasedChannel,
): Promise<ChannelCreateAuditEntry | null> => {
	const me = channel.guild.members.me;
	if (!me?.permissions.has("ViewAuditLog")) {
		return null;
	}

	const auditEvent = getAuditLogEvent(channel);
	const logs = await channel.guild.fetchAuditLogs({
		limit: 6,
		type: auditEvent,
	});

	const now = Date.now();

	for (const entry of logs.entries.values()) {
		if (entry.targetId !== channel.id) continue;
		if (now - entry.createdTimestamp > 15_000) continue;

		return entry as ChannelCreateAuditEntry;
	}

	return null;
};

const fetchLogSnapshot = async (
	channel: GuildBasedChannel,
): Promise<ChannelAuditSnapshot | null> => {
	const guildId = channel.guild.id;

	const [config, eventSetting, bindings, auditEntry] = await Promise.all([
		db.query.logConfigs.findFirst({
			where: eq(logConfigs.guildId, guildId),
		}),
		db.query.logEventSettings.findFirst({
			where: and(eq(logEventSettings.guildId, guildId), eq(logEventSettings.eventType, EVENT_TYPE)),
		}),
		db
			.select({ discordChannelId: logChannelBindings.discordChannelId })
			.from(logChannelBindings)
			.where(
				and(eq(logChannelBindings.guildId, guildId), eq(logChannelBindings.logGroup, LOG_GROUP)),
			),
		fetchMatchingAuditEntry(channel).catch((error: unknown) => {
			log.warn({ error, channel: channel.id, guild: guildId }, "Failed to resolve audit log entry");
			return null;
		}),
	]);

	if (!config) {
		return null;
	}

	return {
		archiveDurationMinutes: getArchiveDurationMinutes(channel),
		auditEntry,
		bitrate: getBitrate(channel),
		createdAt: new Date(),
		discordMessageId: null,
		eventEnabled: eventSetting?.enabled ?? true,
		expiresAt: getRetentionExpiry(config.retentionDays),
		logChannelIds: bindings.map((binding) => binding.discordChannelId),
		nsfw: getNsfw(channel),
		overwriteCount: getOverwriteCount(channel),
		...getParentInfo(channel),
		position: getPosition(channel),
		rateLimitPerUser: getRateLimitPerUser(channel),
		topic: getTopic(channel),
		userLimit: getUserLimit(channel),
	};
};

const buildChannelCreateEmbed = (
	channel: GuildBasedChannel,
	snapshot: ChannelAuditSnapshot,
	avatarUrl?: string,
): EmbedBuilder => {
	const channelTypeLabel = getChannelTypeLabel(channel.type);
	const color = snapshot.auditEntry ? EMBED_COLOR_INFO : EMBED_COLOR_WARN;
	const title = channel.isThread()
		? "🧵  Channel Create — Thread Created"
		: "🆕  Channel Create — Guild Channel Created";
	const description = snapshot.auditEntry
		? [
				`${bold("A new")} ${italic(channelTypeLabel.toLowerCase())} was created in ${inlineCode(channel.guild.name)}.`,
				`${bold("Audit match")} — A matching audit log entry was resolved for this creation event.`,
				`${bold("Persistence")} — The event was recorded in ${inlineCode("log_entries")} and routed to the configured log channels.`,
			].join("\n")
		: [
				`${bold("A new")} ${italic(channelTypeLabel.toLowerCase())} was created in ${inlineCode(channel.guild.name)}.`,
				`${bold("Audit match")} — No matching audit log entry was available yet, so the actor may be missing.`,
				`${bold("Persistence")} — The event was still recorded in ${inlineCode("log_entries")} for traceability.`,
			].join("\n");

	return new EmbedBuilder()
		.setColor(color)
		.setTitle(title)
		.setThumbnail(channel.guild.iconURL({ size: 256 }) ?? avatarUrl ?? null)
		.setDescription(blockQuote(description))
		.addFields(
			{
				name: "📦  Channel",
				value: blockQuote(
					[
						`🏷️ Name:  ${channel.toString()}`,
						`🧾 Type:  ${inlineCode(channelTypeLabel)}`,
						`🆔 ID:  ${inlineCode(channel.id)}`,
						`🕒 Created:  ${time(snapshot.createdAt, TimestampStyles.RelativeTime)}`,
					].join("\n"),
				),
				inline: false,
			},
			{
				name: "👤  Audit",
				value: blockQuote(
					[
						`👮 Actor:  ${formatActorLabel(snapshot.auditEntry)}`,
						`📝 Reason:  ${formatAuditReason(snapshot.auditEntry)}`,
						`📚 Audit entry:  ${snapshot.auditEntry ? inlineCode(snapshot.auditEntry.id) : italic("Unavailable")}`,
						`🧭 Event key:  ${inlineCode(EVENT_TYPE)}`,
					].join("\n"),
				),
				inline: false,
			},
			{
				name: "🧱  Placement",
				value: blockQuote(
					[
						`📁 Parent:  ${snapshot.parentId ? `${inlineCode(snapshot.parentName ?? "Unknown")}  •  ${inlineCode(snapshot.parentId)}` : italic("No parent")}`,
						`📍 Position:  ${formatCount(snapshot.position)}`,
						`🔐 Overwrites:  ${formatCount(snapshot.overwriteCount)}`,
						`🏛️ Guild:  ${inlineCode(channel.guild.id)}`,
					].join("\n"),
				),
				inline: false,
			},
			{
				name: "⚙️  Configuration",
				value: blockQuote(
					[
						`🚫 NSFW:  ${formatBoolean(snapshot.nsfw)}`,
						`⏱️ Slowmode:  ${formatCount(snapshot.rateLimitPerUser, "s")}`,
						`🧵 Auto-archive:  ${formatCount(snapshot.archiveDurationMinutes, "m")}`,
						`📝 Topic:  ${formatNullableText(snapshot.topic, "No topic")}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🔊  Voice / Media",
				value: blockQuote(
					[
						`🎚️ Bitrate:  ${formatCount(snapshot.bitrate, " bps")}`,
						`👥 User limit:  ${formatCount(snapshot.userLimit)}`,
						`🗂️ Log group:  ${inlineCode(LOG_GROUP)}`,
						`⌛ Retention:  ${snapshot.expiresAt ? time(snapshot.expiresAt, TimestampStyles.RelativeTime) : italic("Permanent")}`,
					].join("\n"),
				),
				inline: true,
			},
		)
		.setFooter(buildFooter("Audit Logs  •  Channel Create", avatarUrl))
		.setTimestamp(snapshot.createdAt);
};

const persistAuditEntry = async (
	channel: GuildBasedChannel,
	snapshot: ChannelAuditSnapshot,
): Promise<string | null> => {
	const [created] = await db
		.insert(logEntries)
		.values({
			actorId: snapshot.auditEntry?.executorId ?? null,
			channelId: channel.id,
			createdAt: snapshot.createdAt,
			discordMessageId: snapshot.discordMessageId,
			eventType: EVENT_TYPE,
			expiresAt: snapshot.expiresAt,
			guildId: channel.guild.id,
			logGroup: LOG_GROUP,
			metadata: {
				auditEntryId: snapshot.auditEntry?.id ?? null,
				auditReason: snapshot.auditEntry?.reason ?? null,
				bitrate: snapshot.bitrate,
				channelName: channel.name,
				channelType: getChannelTypeLabel(channel.type),
				nsfw: snapshot.nsfw,
				overwriteCount: snapshot.overwriteCount,
				parentChannelId: snapshot.parentId,
				parentChannelName: snapshot.parentName,
				position: snapshot.position,
				rateLimitPerUser: snapshot.rateLimitPerUser,
				topic: snapshot.topic,
				userLimit: snapshot.userLimit,
			},
			targetId: channel.id,
			targetType: getTargetType(channel),
		})
		.returning({ id: logEntries.id });

	return created?.id ?? null;
};

const sendAuditEmbed = async (
	channel: GuildBasedChannel,
	snapshot: ChannelAuditSnapshot,
): Promise<string | null> => {
	if (snapshot.logChannelIds.length === 0) {
		return null;
	}

	const avatarUrl = channel.client.user.displayAvatarURL({ size: 256 });
	const embed = buildChannelCreateEmbed(channel, snapshot, avatarUrl);

	const sendResults = await Promise.allSettled(
		snapshot.logChannelIds.map(async (logChannelId) => {
			const targetChannel = await channel.client.channels.fetch(logChannelId);
			if (!targetChannel?.isSendable()) return null;
			if (!("guildId" in targetChannel) || targetChannel.guildId !== channel.guild.id) return null;

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
			log.warn(
				{ error: result.reason, channel: channel.id, guild: channel.guild.id },
				"Failed to send channelCreate audit embed to one or more log channels",
			);
		}
	}

	return null;
};

defineEvent({
	name: "channelCreate",
	execute: async (channel) => {
		try {
			const snapshot = await fetchLogSnapshot(channel);
			if (!snapshot) return;
			if (!snapshot.eventEnabled) return;

			const entryId = await persistAuditEntry(channel, snapshot).catch((error: unknown) => {
				log.error(
					{ error, channel: channel.id, guild: channel.guild.id },
					"Failed to persist channelCreate log entry",
				);
				return null;
			});

			const discordMessageId = await sendAuditEmbed(channel, snapshot).catch((error: unknown) => {
				log.error(
					{ error, channel: channel.id, guild: channel.guild.id },
					"Failed to dispatch channelCreate audit embed",
				);
				return null;
			});

			if (entryId && discordMessageId) {
				await db.update(logEntries).set({ discordMessageId }).where(eq(logEntries.id, entryId));
			}

			log.info(
				{
					auditEntryId: snapshot.auditEntry?.id,
					channel: channel.id,
					dispatched: snapshot.logChannelIds.length > 0,
					entryId,
					eventType: EVENT_TYPE,
					guild: channel.guild.id,
					logGroup: LOG_GROUP,
				},
				"channelCreate audit event handled",
			);
		} catch (error) {
			log.error(
				{
					channel: channel.id,
					error,
					guild: channel.guild.id,
				},
				"channelCreate event handler failed",
			);
		}
	},
});
