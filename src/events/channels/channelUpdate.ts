import { defineEvent } from "@zen/events";
import { createLogger } from "@zen/utils/logger";
import {
	AuditLogEvent,
	blockQuote,
	bold,
	EmbedBuilder,
	inlineCode,
	italic,
	time,
	TimestampStyles,
} from "discord.js";

import {
	buildFooter,
	CHANNEL_LOG_GROUP,
	type ChannelState,
	EMBED_COLOR_INFO,
	EMBED_COLOR_WARN,
	fetchChannelLogContext,
	fetchMatchingAuditEntry,
	formatActorLabel,
	formatAuditReason,
	formatBoolean,
	formatCount,
	formatNullableText,
	isGuildChannel,
	persistChannelLogEntry,
	readChannelState,
	sendChannelAuditEmbed,
	updatePersistedMessageId,
} from "./shared";

const log = createLogger("channelUpdate");

const EVENT_TYPE = "channel_update";

const formatChangeValue = (value: boolean | number | string | null): string => {
	if (typeof value === "boolean") return formatBoolean(value);
	if (typeof value === "number") return inlineCode(String(value));
	if (typeof value === "string") return inlineCode(value);
	return italic("None");
};

const collectChanges = (before: ChannelState, after: ChannelState): string[] => {
	const changes: string[] = [];

	const track = (
		label: string,
		oldValue: boolean | number | string | null,
		newValue: boolean | number | string | null,
	) => {
		if (oldValue === newValue) return;
		changes.push(`${label}:  ${formatChangeValue(oldValue)}  →  ${formatChangeValue(newValue)}`);
	};

	track("🏷️ Name", before.name, after.name);
	track("🧾 Type", before.typeLabel, after.typeLabel);
	track("📁 Parent", before.parentName ?? before.parentId, after.parentName ?? after.parentId);
	track("📍 Position", before.position, after.position);
	track("🚫 NSFW", before.nsfw, after.nsfw);
	track("⏱️ Slowmode", before.rateLimitPerUser, after.rateLimitPerUser);
	track("📝 Topic", before.topic, after.topic);
	track("🎚️ Bitrate", before.bitrate, after.bitrate);
	track("👥 User limit", before.userLimit, after.userLimit);
	track("🔐 Overwrites", before.overwriteCount, after.overwriteCount);

	return changes;
};

defineEvent({
	name: "channelUpdate",
	execute: async (oldChannel, newChannel) => {
		if (!(isGuildChannel(oldChannel) && isGuildChannel(newChannel))) return;

		try {
			const before = readChannelState(oldChannel);
			const after = readChannelState(newChannel);
			const changes = collectChanges(before, after);
			if (changes.length === 0) return;

			const logContext = await fetchChannelLogContext(newChannel.guild.id, EVENT_TYPE);
			if (!logContext?.eventEnabled) return;

			const auditEntry = await fetchMatchingAuditEntry(
				newChannel.guild,
				newChannel.id,
				AuditLogEvent.ChannelUpdate,
				log,
			).catch((error: unknown) => {
				log.warn(
					{ error, channel: newChannel.id, guild: newChannel.guild.id },
					"Failed to resolve channelUpdate audit log entry",
				);
				return null;
			});

			const avatarUrl = newChannel.client.user.displayAvatarURL({ size: 256 });
			const thumbnailUrl = newChannel.guild.iconURL({ size: 256 }) ?? avatarUrl;
			const embed = new EmbedBuilder()
				.setColor(auditEntry ? EMBED_COLOR_INFO : EMBED_COLOR_WARN)
				.setTitle("🛠️  Channel Update — Guild Channel Updated")
				.setThumbnail(thumbnailUrl)
				.setDescription(
					blockQuote(
						[
							`${bold("A")} ${italic(after.typeLabel.toLowerCase())} was updated in ${inlineCode(newChannel.guild.name)}.`,
							`${bold("Change count")} — ${inlineCode(String(changes.length))} tracked field${changes.length > 1 ? "s were" : " was"} updated.`,
							`${bold("Persistence")} — The update was recorded in ${inlineCode("log_entries")} and routed to the configured log channels.`,
						].join("\n"),
					),
				)
				.addFields(
					{
						name: "📦  Channel",
						value: blockQuote(
							[
								`🏷️ Name:  ${newChannel.toString()}`,
								`🧾 Type:  ${inlineCode(after.typeLabel)}`,
								`🆔 ID:  ${inlineCode(after.id)}`,
								`🕒 Logged:  ${time(logContext.createdAt, TimestampStyles.RelativeTime)}`,
							].join("\n"),
						),
						inline: false,
					},
					{
						name: "👤  Audit",
						value: blockQuote(
							[
								`👮 Actor:  ${formatActorLabel(auditEntry)}`,
								`📝 Reason:  ${formatAuditReason(auditEntry)}`,
								`📚 Audit entry:  ${auditEntry ? inlineCode(auditEntry.id) : italic("Unavailable")}`,
								`🧭 Event key:  ${inlineCode(EVENT_TYPE)}`,
							].join("\n"),
						),
						inline: false,
					},
					{
						name: "🧱  Placement",
						value: blockQuote(
							[
								`📁 Parent:  ${after.parentId ? `${inlineCode(after.parentName ?? "Unknown")}  •  ${inlineCode(after.parentId)}` : italic("No parent")}`,
								`📍 Position:  ${formatCount(after.position)}`,
								`🔐 Overwrites:  ${formatCount(after.overwriteCount)}`,
								`🏛️ Guild:  ${inlineCode(newChannel.guild.id)}`,
							].join("\n"),
						),
						inline: false,
					},
					{
						name: "📝  Changes",
						value: blockQuote(changes.join("\n")),
						inline: false,
					},
					{
						name: "⚙️  Current Configuration",
						value: blockQuote(
							[
								`🚫 NSFW:  ${formatBoolean(after.nsfw)}`,
								`⏱️ Slowmode:  ${formatCount(after.rateLimitPerUser, "s")}`,
								`📝 Topic:  ${formatNullableText(after.topic, "No topic")}`,
								`⌛ Retention:  ${logContext.expiresAt ? time(logContext.expiresAt, TimestampStyles.RelativeTime) : italic("Permanent")}`,
							].join("\n"),
						),
						inline: false,
					},
				)
				.setFooter(buildFooter("Audit Logs  •  Channel Update", avatarUrl))
				.setTimestamp(logContext.createdAt);

			const entryId = await persistChannelLogEntry({
				actorId: auditEntry?.executorId ?? null,
				channelId: newChannel.id,
				createdAt: logContext.createdAt,
				eventType: EVENT_TYPE,
				expiresAt: logContext.expiresAt,
				guildId: newChannel.guild.id,
				metadata: {
					auditEntryId: auditEntry?.id ?? null,
					auditReason: auditEntry?.reason ?? null,
					changes,
					new: after,
					old: before,
				},
				targetId: newChannel.id,
				targetType: "channel",
			});

			const discordMessageId = await sendChannelAuditEmbed(
				newChannel.client,
				newChannel.guild.id,
				logContext.logChannelIds,
				embed,
				log,
				"Failed to send channelUpdate audit embed to one or more log channels",
			);

			if (entryId && discordMessageId) {
				await updatePersistedMessageId(entryId, discordMessageId);
			}

			log.info(
				{
					auditEntryId: auditEntry?.id,
					channel: newChannel.id,
					changeCount: changes.length,
					dispatched: logContext.logChannelIds.length > 0,
					entryId,
					eventType: EVENT_TYPE,
					guild: newChannel.guild.id,
					logGroup: CHANNEL_LOG_GROUP,
				},
				"channelUpdate audit event handled",
			);
		} catch (error) {
			log.error(
				{ channel: newChannel.id, error, guild: newChannel.guild.id },
				"channelUpdate event handler failed",
			);
		}
	},
});
