import {
	AuditLogEvent,
	blockQuote,
	bold,
	ChannelType,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	PermissionsBitField,
	roleMention,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:channelCreate");

const CHANNEL_TYPE_LABEL: Partial<Record<ChannelType, string>> = {
	[ChannelType.GuildText]: "📝 Text Channel",
	[ChannelType.GuildVoice]: "🔊 Voice Channel",
	[ChannelType.GuildCategory]: "📂 Category",
	[ChannelType.GuildAnnouncement]: "📣 Announcement Channel",
	[ChannelType.GuildStageVoice]: "🎙️ Stage Channel",
	[ChannelType.GuildForum]: "💬 Forum Channel",
	[ChannelType.GuildMedia]: "🖼️ Media Channel",
};

const formatChannelType = (type: ChannelType): string => CHANNEL_TYPE_LABEL[type] ?? `Unknown (${type})`;

const formatBitrate = (bps: number): string => {
	const kbps = bps / 1_000;
	return kbps >= 1_000 ? `${kbps / 1_000}Mbps` : `${kbps}kbps`;
};

const formatRegion = (region: string | null): string => region ?? "Automatic";

defineEvent({
	name: "channelCreate",
	once: false,
	execute: async (channel) => {
		const logChannel = await getAuditLogChannel(channel.guild, "channel");
		if (!logChannel) return;

		log.debug(
			{ guildId: channel.guild.id, channelId: channel.id, type: channel.type },
			`Channel created: #${channel.name}`,
		);

		const executor = await channel.guild
			.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 1 })
			.then((audit) => audit.entries.first()?.executor ?? null)
			.catch(() => null);

		const isCategorized = "parentId" in channel && channel.parentId !== null;
		const isVoiceBased = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
		const isTextBased = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement;
		const isForum = channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia;

		const overwrites = [...channel.permissionOverwrites.cache.values()];
		const overwriteSummary =
			overwrites.length === 0
				? bold("None (inherits from category)")
				: overwrites
						.slice(0, 5)
						.map((o) => {
							const target = o.type === 0 ? roleMention(o.id) : userMention(o.id);
							const allowed = o.allow.equals(new PermissionsBitField(0n))
								? null
								: `✅ ${o.allow.toArray().join(", ")}`;
							const denied = o.deny.equals(new PermissionsBitField(0n))
								? null
								: `❌ ${o.deny.toArray().join(", ")}`;
							return [target, allowed, denied].filter(Boolean).join(" — ");
						})
						.join("\n")
						.concat(overwrites.length > 5 ? `\n…and ${overwrites.length - 5} more` : "");

		const fields = [
			{
				name: "📋 Details",
				value: blockQuote(
					[
						`${inlineCode("Name:")}     ${bold(channel.name)}`,
						`${inlineCode("ID:")}       ${inlineCode(channel.id)}`,
						`${inlineCode("Type:")}     ${bold(formatChannelType(channel.type))}`,
						isCategorized
							? `${inlineCode("Category:")} ${bold(channel.parent?.name ?? "Unknown")} (${inlineCode(channel.parentId!)})`
							: `${inlineCode("Category:")} ${bold("None — Top-level channel")}`,
						"position" in channel ? `${inlineCode("Position:")} ${bold(String(channel.position))}` : null,
					]
						.filter(Boolean)
						.join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Created By",
				value: blockQuote(
					executor
						? `${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`
						: `${inlineCode("User:")} ${bold("Unknown")}`,
				),
				inline: true,
			},
		];

		if (isTextBased) {
			const text = channel as { topic?: string | null; nsfw: boolean; rateLimitPerUser: number };
			fields.push({
				name: "⚙️ Text Settings",
				value: blockQuote(
					[
						`${inlineCode("NSFW:")}     ${bold(text.nsfw ? "Yes" : "No")}`,
						`${inlineCode("Slowmode:")} ${bold(text.rateLimitPerUser ? `${text.rateLimitPerUser}s` : "Off")}`,
						text.topic
							? `${inlineCode("Topic:")}    ${bold(text.topic.length > 80 ? `${text.topic.slice(0, 80)}…` : text.topic)}`
							: `${inlineCode("Topic:")}    ${bold("None")}`,
					].join("\n"),
				),
				inline: false,
			});
		}

		if (isVoiceBased) {
			const voice = channel as { bitrate: number; userLimit: number; rtcRegion: string | null };
			fields.push({
				name: "⚙️ Voice Settings",
				value: blockQuote(
					[
						`${inlineCode("Bitrate:")}   ${bold(formatBitrate(voice.bitrate))}`,
						`${inlineCode("User Limit:")} ${bold(voice.userLimit === 0 ? "Unlimited" : String(voice.userLimit))}`,
						`${inlineCode("Region:")}    ${bold(formatRegion(voice.rtcRegion))}`,
					].join("\n"),
				),
				inline: false,
			});
		}

		if (isForum) {
			const forum = channel as { topic?: string | null; nsfw: boolean; rateLimitPerUser: number };
			fields.push({
				name: "⚙️ Forum Settings",
				value: blockQuote(
					[
						`${inlineCode("NSFW:")}       ${bold(forum.nsfw ? "Yes" : "No")}`,
						`${inlineCode("Post Slowmode:")} ${bold(forum.rateLimitPerUser ? `${forum.rateLimitPerUser}s` : "Off")}`,
						forum.topic
							? `${inlineCode("Guidelines:")} ${bold(forum.topic.length > 80 ? `${forum.topic.slice(0, 80)}…` : forum.topic)}`
							: `${inlineCode("Guidelines:")} ${bold("None")}`,
					].join("\n"),
				),
				inline: false,
			});
		}

		fields.push({
			name: `🔒 Permission Overwrites (${overwrites.length})`,
			value: blockQuote(overwriteSummary),
			inline: false,
		});

		fields.push({
			name: "🕐 Created At",
			value: blockQuote(
				`${time(channel.createdAt ?? new Date(), TimestampStyles.FullDateShortTime)} (${time(channel.createdAt ?? new Date(), TimestampStyles.RelativeTime)})`,
			),
			inline: false,
		});

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("📁 Channel Created")
					.setDescription(`A new channel has been created: ${channelMention(channel.id)}.`)
					.setColor(Colors.Green)
					.addFields(...fields)
					.setFooter({ text: `Zen • Channel Logs  •  ID: ${channel.id}` })
					.setTimestamp(),
			],
		});
	},
});
