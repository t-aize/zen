import { blockQuote, bold, Colors, channelMention, EmbedBuilder, inlineCode, TimestampStyles, time } from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:messageReactionRemoveAll");

defineEvent({
	name: "messageReactionRemoveAll",
	once: false,
	execute: async (message, reactions) => {
		if (!message.inGuild()) return;

		const logChannel = await getAuditLogChannel(message.guild, "message");
		if (!logChannel) return;

		log.debug(
			{
				guildId: message.guild.id,
				channelId: message.channelId,
				messageId: message.id,
				reactionCount: reactions.size,
			},
			`All reactions cleared on message ${message.id}`,
		);

		const emojiSummary =
			reactions.size === 0
				? bold("None cached")
				: [...reactions.values()]
						.slice(0, 10)
						.map((r) => `${r.emoji.toString()} ${inlineCode(String(r.count))}`)
						.join("  ") + (reactions.size > 10 ? `  …+${reactions.size - 10} more` : "");

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🧹 All Reactions Cleared")
					.setDescription(
						`All reactions were removed from a message in ${channelMention(message.channelId)}.`,
					)
					.setColor(Colors.DarkOrange)
					.addFields(
						{
							name: "📍 Message",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(message.channelId)}`,
									`${inlineCode("Msg ID:")}  ${inlineCode(message.id)}`,
									`${inlineCode("Author:")}  ${message.author ? bold(message.author.tag) : bold("Unknown")}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📊 Stats",
							value: blockQuote(`${inlineCode("Unique emojis:")} ${bold(String(reactions.size))}`),
							inline: true,
						},
						{
							name: "😀 Emojis",
							value: blockQuote(emojiSummary),
							inline: false,
						},
						{
							name: "🕐 Cleared At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Message Logs  •  Msg ID: ${message.id}` })
					.setTimestamp(),
			],
		});
	},
});
