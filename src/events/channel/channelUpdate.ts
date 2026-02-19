import {
	AuditLogEvent,
	blockQuote,
	bold,
	ChannelType,
	Colors,
	channelMention,
	type DMChannel,
	EmbedBuilder,
	inlineCode,
	type NonThreadGuildBasedChannel,
	roleMention,
	strikethrough,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:channelUpdate");

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

const diff = (label: string, before: unknown, after: unknown): string | null => {
	const b = String(before ?? "None");
	const a = String(after ?? "None");
	if (b === a) return null;
	return `${inlineCode(label)} ${strikethrough(b)} → ${bold(a)}`;
};

defineEvent({
	name: "channelUpdate",
	once: false,
	execute: async (
		oldChannel: DMChannel | NonThreadGuildBasedChannel,
		newChannel: DMChannel | NonThreadGuildBasedChannel,
	) => {
		if (!("guild" in newChannel)) return;

		const logChannel = await getAuditLogChannel(newChannel.guild, "channel");
		if (!logChannel) return;

		log.debug({ guildId: newChannel.guild.id, channelId: newChannel.id }, `Channel updated: #${newChannel.name}`);

		const executor = await newChannel.guild
			.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 1 })
			.then((audit) => audit.entries.first()?.executor ?? null)
			.catch(() => null);

		const changes: string[] = [];

		if ("name" in oldChannel && "name" in newChannel)
			changes.push(...([diff("Name:", oldChannel.name, newChannel.name)].filter(Boolean) as string[]));

		if ("topic" in oldChannel && "topic" in newChannel)
			changes.push(
				...([diff("Topic:", oldChannel.topic ?? "None", newChannel.topic ?? "None")].filter(
					Boolean,
				) as string[]),
			);

		if ("nsfw" in oldChannel && "nsfw" in newChannel && oldChannel.nsfw !== newChannel.nsfw)
			changes.push(
				`${inlineCode("NSFW:")} ${bold(oldChannel.nsfw ? "Yes" : "No")} → ${bold(newChannel.nsfw ? "Yes" : "No")}`,
			);

		if ("rateLimitPerUser" in oldChannel && "rateLimitPerUser" in newChannel)
			changes.push(
				...([diff("Slowmode:", `${oldChannel.rateLimitPerUser}s`, `${newChannel.rateLimitPerUser}s`)].filter(
					Boolean,
				) as string[]),
			);

		if ("bitrate" in oldChannel && "bitrate" in newChannel && oldChannel.bitrate !== newChannel.bitrate)
			changes.push(
				`${inlineCode("Bitrate:")} ${bold(formatBitrate(oldChannel.bitrate as number))} → ${bold(formatBitrate(newChannel.bitrate as number))}`,
			);

		if ("userLimit" in oldChannel && "userLimit" in newChannel && oldChannel.userLimit !== newChannel.userLimit)
			changes.push(
				`${inlineCode("User Limit:")} ${bold((oldChannel.userLimit as number) === 0 ? "Unlimited" : String(oldChannel.userLimit))} → ${bold((newChannel.userLimit as number) === 0 ? "Unlimited" : String(newChannel.userLimit))}`,
			);

		if ("rtcRegion" in oldChannel && "rtcRegion" in newChannel && oldChannel.rtcRegion !== newChannel.rtcRegion)
			changes.push(
				`${inlineCode("Region:")} ${bold((oldChannel.rtcRegion as string | null) ?? "Automatic")} → ${bold((newChannel.rtcRegion as string | null) ?? "Automatic")}`,
			);

		if ("parentId" in oldChannel && "parentId" in newChannel && oldChannel.parentId !== newChannel.parentId) {
			const oldCat = oldChannel.parentId
				? ((newChannel as NonThreadGuildBasedChannel).guild.channels.cache.get(oldChannel.parentId)?.name ??
					oldChannel.parentId)
				: "None";
			const newCat = newChannel.parentId
				? ((newChannel as NonThreadGuildBasedChannel).guild.channels.cache.get(newChannel.parentId)?.name ??
					newChannel.parentId)
				: "None";
			changes.push(`${inlineCode("Category:")} ${bold(oldCat)} → ${bold(newCat)}`);
		}

		if ("position" in oldChannel && "position" in newChannel && oldChannel.position !== newChannel.position)
			changes.push(
				`${inlineCode("Position:")} ${bold(String(oldChannel.position))} → ${bold(String(newChannel.position))}`,
			);

		const oldOverwrites =
			"permissionOverwrites" in oldChannel
				? [...(oldChannel as NonThreadGuildBasedChannel).permissionOverwrites.cache.keys()]
				: [];
		const newOverwrites =
			"permissionOverwrites" in newChannel
				? [...(newChannel as NonThreadGuildBasedChannel).permissionOverwrites.cache.keys()]
				: [];
		const addedOverwrites = newOverwrites.filter((id) => !oldOverwrites.includes(id));
		const removedOverwrites = oldOverwrites.filter((id) => !newOverwrites.includes(id));

		if (addedOverwrites.length > 0)
			changes.push(
				`${inlineCode("Overwrites added:")}   ${addedOverwrites.map((id) => `${roleMention(id)} / ${userMention(id)}`).join(", ")}`,
			);
		if (removedOverwrites.length > 0)
			changes.push(
				`${inlineCode("Overwrites removed:")} ${removedOverwrites.map((id) => `${roleMention(id)} / ${userMention(id)}`).join(", ")}`,
			);

		if (changes.length === 0) return;

		const guildChannel = newChannel as NonThreadGuildBasedChannel;

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("✏️ Channel Updated")
					.setDescription(`${channelMention(newChannel.id)} has been modified.`)
					.setColor(Colors.Yellow)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Name:")} ${bold("name" in newChannel ? newChannel.name : "Unknown")}`,
									`${inlineCode("ID:")}   ${inlineCode(newChannel.id)}`,
									`${inlineCode("Type:")} ${bold(formatChannelType(newChannel.type))}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "🛡️ Updated By",
							value: blockQuote(
								executor
									? `${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`
									: `${inlineCode("User:")} ${bold("Unknown")}`,
							),
							inline: true,
						},
						{
							name: `📝 Changes (${changes.length})`,
							value: blockQuote(changes.join("\n")),
							inline: false,
						},
						{
							name: "🕐 Updated At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Channel Logs  •  ID: ${guildChannel.id}` })
					.setTimestamp(),
			],
		});
	},
});
