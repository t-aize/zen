import { blockQuote, bold, Colors, channelMention, EmbedBuilder, inlineCode, TimestampStyles, time } from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:messageReactionRemoveEmoji");

defineEvent({
	name: "messageReactionRemoveEmoji",
	once: false,
	execute: async (reaction) => {
		if (!reaction.message.inGuild()) return;

		const logChannel = await getAuditLogChannel(reaction.message.guild, "message");
		if (!logChannel) return;

		log.debug(
			{ guildId: reaction.message.guild.id, messageId: reaction.message.id, emoji: reaction.emoji.name },
			`All reactions for emoji ${reaction.emoji.name} removed from message ${reaction.message.id}`,
		);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🚫 Emoji Reactions Cleared")
					.setDescription(
						`All reactions for a specific emoji were removed from a message in ${channelMention(reaction.message.channelId)}.`,
					)
					.setColor(Colors.DarkOrange)
					.addFields(
						{
							name: "😀 Emoji",
							value: blockQuote(
								[
									`${inlineCode("Emoji:")} ${bold(reaction.emoji.toString())}`,
									`${inlineCode("Name:")}  ${bold(reaction.emoji.name ?? "Unknown")}`,
									...(reaction.emoji.id
										? [`${inlineCode("ID:")}    ${inlineCode(reaction.emoji.id)}`]
										: []),
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📍 Message",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(reaction.message.channelId)}`,
									`${inlineCode("Msg ID:")}  ${inlineCode(reaction.message.id)}`,
									`${inlineCode("Author:")}  ${reaction.message.author ? bold(reaction.message.author.tag) : bold("Unknown")}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "🕐 Cleared At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Message Logs  •  Msg ID: ${reaction.message.id}` })
					.setTimestamp(),
			],
		});
	},
});
