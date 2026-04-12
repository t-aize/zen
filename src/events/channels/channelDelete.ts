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
	EMBED_COLOR_ERROR,
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

const log = createLogger("channelDelete");

const EVENT_TYPE = "channel_delete";

defineEvent({
	name: "channelDelete",
	execute: async (channel) => {
		if (!isGuildChannel(channel)) return;

		try {
			const logContext = await fetchChannelLogContext(channel.guild.id, EVENT_TYPE);
			if (!logContext?.eventEnabled) return;

			const state = readChannelState(channel);
			const auditEntry = await fetchMatchingAuditEntry(
				channel.guild,
				channel.id,
				AuditLogEvent.ChannelDelete,
				log,
			).catch((error: unknown) => {
				log.warn(
					{ error, channel: channel.id, guild: channel.guild.id },
					"Failed to resolve channelDelete audit log entry",
				);
				return null;
			});

			const description = auditEntry
				? [
						`${bold("A")} ${italic(state.typeLabel.toLowerCase())} was deleted from ${inlineCode(channel.guild.name)}.`,
						`${bold("Audit match")} — A matching audit log entry was resolved for this deletion event.`,
						`${bold("Persistence")} — The deletion was recorded in ${inlineCode("log_entries")} and routed to the configured log channels.`,
					].join("\n")
				: [
						`${bold("A")} ${italic(state.typeLabel.toLowerCase())} was deleted from ${inlineCode(channel.guild.name)}.`,
						`${bold("Audit match")} — No matching audit log entry was available yet, so the actor may be missing.`,
						`${bold("Persistence")} — The deletion was still recorded in ${inlineCode("log_entries")} for traceability.`,
					].join("\n");

			const avatarUrl = channel.client.user.displayAvatarURL({ size: 256 });
			const thumbnailUrl = channel.guild.iconURL({ size: 256 }) ?? avatarUrl;
			const embed = new EmbedBuilder()
				.setColor(auditEntry ? EMBED_COLOR_ERROR : EMBED_COLOR_WARN)
				.setTitle("🗑️  Channel Delete — Guild Channel Deleted")
				.setThumbnail(thumbnailUrl)
				.setDescription(blockQuote(description))
				.addFields(
					{
						name: "📦  Channel",
						value: blockQuote(
							[
								`🏷️ Name:  ${inlineCode(state.name)}`,
								`🧾 Type:  ${inlineCode(state.typeLabel)}`,
								`🆔 ID:  ${inlineCode(state.id)}`,
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
								`📁 Parent:  ${state.parentId ? `${inlineCode(state.parentName ?? "Unknown")}  •  ${inlineCode(state.parentId)}` : italic("No parent")}`,
								`📍 Position:  ${formatCount(state.position)}`,
								`🔐 Overwrites:  ${formatCount(state.overwriteCount)}`,
								`🏛️ Guild:  ${inlineCode(channel.guild.id)}`,
							].join("\n"),
						),
						inline: false,
					},
					{
						name: "⚙️  Configuration",
						value: blockQuote(
							[
								`🚫 NSFW:  ${formatBoolean(state.nsfw)}`,
								`⏱️ Slowmode:  ${formatCount(state.rateLimitPerUser, "s")}`,
								`📝 Topic:  ${formatNullableText(state.topic, "No topic")}`,
							].join("\n"),
						),
						inline: true,
					},
					{
						name: "🔊  Voice / Media",
						value: blockQuote(
							[
								`🎚️ Bitrate:  ${formatCount(state.bitrate, " bps")}`,
								`👥 User limit:  ${formatCount(state.userLimit)}`,
								`🗂️ Log group:  ${inlineCode(CHANNEL_LOG_GROUP)}`,
								`⌛ Retention:  ${logContext.expiresAt ? time(logContext.expiresAt, TimestampStyles.RelativeTime) : italic("Permanent")}`,
							].join("\n"),
						),
						inline: true,
					},
				)
				.setFooter(buildFooter("Audit Logs  •  Channel Delete", avatarUrl))
				.setTimestamp(logContext.createdAt);

			const entryId = await persistChannelLogEntry({
				actorId: auditEntry?.executorId ?? null,
				channelId: channel.id,
				createdAt: logContext.createdAt,
				eventType: EVENT_TYPE,
				expiresAt: logContext.expiresAt,
				guildId: channel.guild.id,
				metadata: {
					auditEntryId: auditEntry?.id ?? null,
					auditReason: auditEntry?.reason ?? null,
					bitrate: state.bitrate,
					channelName: state.name,
					channelType: state.typeLabel,
					nsfw: state.nsfw,
					overwriteCount: state.overwriteCount,
					parentChannelId: state.parentId,
					parentChannelName: state.parentName,
					position: state.position,
					rateLimitPerUser: state.rateLimitPerUser,
					topic: state.topic,
					userLimit: state.userLimit,
				},
				targetId: channel.id,
				targetType: "channel",
			});

			const discordMessageId = await sendChannelAuditEmbed(
				channel.client,
				channel.guild.id,
				logContext.logChannelIds,
				embed,
				log,
				"Failed to send channelDelete audit embed to one or more log channels",
			);

			if (entryId && discordMessageId) {
				await updatePersistedMessageId(entryId, discordMessageId);
			}

			log.info(
				{
					auditEntryId: auditEntry?.id,
					channel: channel.id,
					dispatched: logContext.logChannelIds.length > 0,
					entryId,
					eventType: EVENT_TYPE,
					guild: channel.guild.id,
					logGroup: CHANNEL_LOG_GROUP,
				},
				"channelDelete audit event handled",
			);
		} catch (error) {
			log.error(
				{ channel: channel.id, error, guild: channel.guild.id },
				"channelDelete event handler failed",
			);
		}
	},
});
