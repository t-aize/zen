import {
	AuditLogEvent,
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	TimestampStyles,
	time,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:messageDelete");

const truncate = (str: string, max: number): string => (str.length > max ? `${str.slice(0, max)}…` : str);

defineEvent({
	name: "messageDelete",
	once: false,
	execute: async (message) => {
		if (!message.inGuild()) return;
		if (message.author?.bot) return;

		const logChannel = await getAuditLogChannel(message.guild, "message");
		if (!logChannel) return;

		log.debug(
			{ guildId: message.guild.id, channelId: message.channelId, messageId: message.id },
			`Message deleted in #${message.channel.name}`,
		);

		const executor = await message.guild
			.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 1 })
			.then((audit) => {
				const entry = audit.entries.first();
				if (!entry) return null;
				if (Date.now() - entry.createdTimestamp > 5_000) return null;
				return entry.executor ?? null;
			})
			.catch(() => null);

		const content = message.content && message.content.length > 0 ? truncate(message.content, 1_000) : null;
		const attachments = message.attachments ? [...message.attachments.values()] : [];

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🗑️ Message Deleted")
					.setDescription(`A message in ${channelMention(message.channelId)} was deleted.`)
					.setColor(Colors.Red)
					.addFields(
						{
							name: "👤 Author",
							value: blockQuote(
								message.author
									? `${inlineCode("User:")} ${bold(message.author.tag)}\n${inlineCode("ID:")}   ${inlineCode(message.author.id)}`
									: `${inlineCode("User:")} ${bold("Unknown (partial message)")}`,
							),
							inline: true,
						},
						{
							name: "🛡️ Deleted By",
							value: blockQuote(
								executor
									? `${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`
									: `${inlineCode("User:")} ${bold("Author or unknown")}`,
							),
							inline: true,
						},
						{
							name: "📍 Location",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(message.channelId)}`,
									`${inlineCode("Msg ID:")}  ${inlineCode(message.id)}`,
								].join("\n"),
							),
							inline: false,
						},
						...(content
							? [
									{
										name: "📝 Content",
										value: blockQuote(content),
										inline: false,
									},
								]
							: [
									{
										name: "📝 Content",
										value: blockQuote(bold("Not available — message was not cached.")),
										inline: false,
									},
								]),
						...(attachments.length > 0
							? [
									{
										name: `📎 Attachments (${attachments.length})`,
										value: blockQuote(
											attachments
												.slice(0, 5)
												.map((a) => bold(a.name))
												.join("\n"),
										),
										inline: false,
									},
								]
							: []),
						...(message.createdAt
							? [
									{
										name: "🕐 Originally Sent",
										value: blockQuote(
											`${time(message.createdAt, TimestampStyles.FullDateShortTime)} (${time(message.createdAt, TimestampStyles.RelativeTime)})`,
										),
										inline: false,
									},
								]
							: []),
					)
					.setFooter({ text: `Zen • Message Logs  •  ID: ${message.id}` })
					.setTimestamp(),
			],
		});
	},
});
