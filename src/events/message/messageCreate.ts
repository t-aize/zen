import {
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:messageCreate");

const truncate = (str: string, max: number): string => (str.length > max ? `${str.slice(0, max)}…` : str);

defineEvent({
	name: "messageCreate",
	once: false,
	execute: async (message) => {
		if (!message.inGuild()) return;
		if (message.author.bot) return;

		const logChannel = await getAuditLogChannel(message.guild, "message");
		if (!logChannel) return;

		log.debug(
			{
				guildId: message.guild.id,
				channelId: message.channelId,
				messageId: message.id,
				authorId: message.author.id,
			},
			`Message created by ${message.author.tag}`,
		);

		const content = message.content.length > 0 ? truncate(message.content, 1_000) : null;
		const attachments = [...message.attachments.values()];
		const embeds = message.embeds.length;
		const stickers = [...message.stickers.values()];

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("💬 Message Sent")
					.setDescription(
						`A message was sent in ${channelMention(message.channelId)} by ${userMention(message.author.id)}.`,
					)
					.setColor(Colors.Blurple)
					.setThumbnail(message.author.displayAvatarURL({ size: 128 }))
					.addFields(
						{
							name: "👤 Author",
							value: blockQuote(
								[
									`${inlineCode("User:")} ${bold(message.author.tag)}`,
									`${inlineCode("ID:")}   ${inlineCode(message.author.id)}`,
									`${inlineCode("Bot:")}  ${bold(message.author.bot ? "Yes" : "No")}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📍 Location",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(message.channelId)}`,
									`${inlineCode("ID:")}      ${inlineCode(message.channelId)}`,
									...(message.thread
										? [`${inlineCode("Thread:")}  ${channelMention(message.thread.id)}`]
										: []),
								].join("\n"),
							),
							inline: true,
						},
						...(content
							? [
									{
										name: "📝 Content",
										value: blockQuote(content),
										inline: false,
									},
								]
							: []),
						...(attachments.length > 0
							? [
									{
										name: `📎 Attachments (${attachments.length})`,
										value: blockQuote(
											attachments
												.slice(0, 5)
												.map((a) => `[${bold(a.name)}](${a.url})`)
												.join("\n") +
												(attachments.length > 5 ? `\n…+${attachments.length - 5} more` : ""),
										),
										inline: false,
									},
								]
							: []),
						...(embeds > 0 || stickers.length > 0
							? [
									{
										name: "📦 Extras",
										value: blockQuote(
											[
												embeds > 0
													? `${inlineCode("Embeds:")}   ${bold(String(embeds))}`
													: null,
												stickers.length > 0
													? `${inlineCode("Stickers:")} ${bold(stickers.map((s) => s.name).join(", "))}`
													: null,
											]
												.filter(Boolean)
												.join("\n"),
										),
										inline: false,
									},
								]
							: []),
						{
							name: "🕐 Sent At",
							value: blockQuote(
								`${time(message.createdAt, TimestampStyles.FullDateShortTime)} (${time(message.createdAt, TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Message Logs  •  ID: ${message.id}` })
					.setTimestamp(),
			],
		});
	},
});
