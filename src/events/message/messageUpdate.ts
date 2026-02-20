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

const log = createLogger("event:messageUpdate");

const truncate = (str: string, max: number): string => (str.length > max ? `${str.slice(0, max)}…` : str);

defineEvent({
	name: "messageUpdate",
	once: false,
	execute: async (oldMessage, newMessage) => {
		if (!newMessage.inGuild()) return;
		if (newMessage.author?.bot) return;

		const oldContent = oldMessage.content ?? null;
		const newContent = newMessage.content ?? null;

		if (oldContent === newContent) return;

		const logChannel = await getAuditLogChannel(newMessage.guild, "message");
		if (!logChannel) return;

		log.debug(
			{
				guildId: newMessage.guild.id,
				channelId: newMessage.channelId,
				messageId: newMessage.id,
				authorId: newMessage.author?.id,
			},
			`Message edited by ${newMessage.author?.tag ?? "unknown"}`,
		);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("✏️ Message Edited")
					.setDescription(
						`A message in ${channelMention(newMessage.channelId)} was edited by ${userMention(newMessage.author.id)}.`,
					)
					.setColor(Colors.Yellow)
					.setThumbnail(newMessage.author.displayAvatarURL({ size: 128 }))
					.addFields(
						{
							name: "👤 Author",
							value: blockQuote(
								[
									`${inlineCode("User:")} ${bold(newMessage.author.tag)}`,
									`${inlineCode("ID:")}   ${inlineCode(newMessage.author.id)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📍 Location",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(newMessage.channelId)}`,
									`${inlineCode("Msg ID:")}  ${inlineCode(newMessage.id)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📝 Before",
							value: blockQuote(
								oldContent && oldContent.length > 0
									? truncate(oldContent, 1_000)
									: bold("Not available — message was not cached."),
							),
							inline: false,
						},
						{
							name: "📝 After",
							value: blockQuote(
								newContent && newContent.length > 0
									? truncate(newContent, 1_000)
									: bold("Empty message."),
							),
							inline: false,
						},
						{
							name: "🕐 Edited At",
							value: blockQuote(
								`${time(newMessage.editedAt ?? new Date(), TimestampStyles.FullDateShortTime)} (${time(newMessage.editedAt ?? new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Message Logs  •  ID: ${newMessage.id}` })
					.setTimestamp(),
			],
		});
	},
});
