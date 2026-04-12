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
	EMBED_COLOR_INFO,
	EMBED_COLOR_WARN,
	fetchChannelLogContext,
	fetchMatchingAuditEntry,
	formatActorLabel,
	formatAuditReason,
	formatBoolean,
	formatCount,
	formatNullableText,
	persistChannelLogEntry,
	readChannelState,
	sendChannelAuditEmbed,
	updatePersistedMessageId,
} from "./shared";

const log = createLogger("channelCreate");

const EVENT_TYPE = "channel_create";

defineEvent({
	name: "channelCreate",
	execute: async (channel) => {
		try {
			const logContext = await fetchChannelLogContext(channel.guild.id, EVENT_TYPE);
			if (!logContext?.eventEnabled) return;

			const state = readChannelState(channel);
			const auditEntry = await fetchMatchingAuditEntry(
				channel.guild,
				channel.id,
				AuditLogEvent.ChannelCreate,
				log,
			).catch((error: unknown) => {
				log.warn(
					{ error, channel: channel.id, guild: channel.guild.id },
					"Failed to resolve channelCreate audit log entry",
				);
				return null;
			});

			const description = auditEntry
				? [
						`${bold("A new")} ${italic(state.typeLabel.toLowerCase())} was created in ${inlineCode(channel.guild.name)}.`,
						`${bold("Audit match")} — A matching audit log entry was resolved for this creation event.`,
						`${bold("Persistence")} — The event was recorded in ${inlineCode("log_entries")} and routed to the configured log channels.`,
					].join("\n")
				: [
						`${bold("A new")} ${italic(state.typeLabel.toLowerCase())} was created in ${inlineCode(channel.guild.name)}.`,
						`${bold("Audit match")} — No matching audit log entry was available yet, so the actor may be missing.`,
						`${bold("Persistence")} — The event was still recorded in ${inlineCode("log_entries")} for traceability.`,
					].join("\n");

			const avatarUrl = channel.client.user.displayAvatarURL({ size: 256 });
			const thumbnailUrl = channel.guild.iconURL({ size: 256 }) ?? avatarUrl;
			const embed = new EmbedBuilder()
				.setColor(auditEntry ? EMBED_COLOR_INFO : EMBED_COLOR_WARN)
				.setTitle("🆕  Channel Create — Guild Channel Created")
				.setThumbnail(thumbnailUrl)
				.setDescription(blockQuote(description))
				.addFields(
					{
						name: "📦  Channel",
						value: blockQuote(
							[
								`🏷️ Name:  ${channel.toString()}`,
								`🧾 Type:  ${inlineCode(state.typeLabel)}`,
								`🆔 ID:  ${inlineCode(state.id)}`,
								`🕒 Created:  ${time(logContext.createdAt, TimestampStyles.RelativeTime)}`,
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
				.setFooter(buildFooter("Audit Logs  •  Channel Create", avatarUrl))
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
				"Failed to send channelCreate audit embed to one or more log channels",
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
				"channelCreate audit event handled",
			);
		} catch (error) {
			log.error(
				{ channel: channel.id, error, guild: channel.guild.id },
				"channelCreate event handler failed",
			);
		}
	},
});
