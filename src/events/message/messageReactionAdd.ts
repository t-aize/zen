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

const log = createLogger("event:messageReactionAdd");

defineEvent({
	name: "messageReactionAdd",
	once: false,
	execute: async (reaction, user) => {
		if (!reaction.message.inGuild()) return;
		if (user.bot) return;

		const logChannel = await getAuditLogChannel(reaction.message.guild, "message");
		if (!logChannel) return;

		const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
		if (!fullReaction) return;

		log.debug(
			{
				guildId: reaction.message.guild.id,
				messageId: reaction.message.id,
				userId: user.id,
				emoji: fullReaction.emoji.name,
			},
			`Reaction added by ${user.tag ?? user.id}`,
		);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("😀 Reaction Added")
					.setDescription(
						`${userMention(user.id)} reacted to a message in ${channelMention(reaction.message.channelId)}.`,
					)
					.setColor(Colors.Green)
					.addFields(
						{
							name: "👤 User",
							value: blockQuote(
								[
									`${inlineCode("User:")} ${bold(user.tag ?? user.id)}`,
									`${inlineCode("ID:")}   ${inlineCode(user.id)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "😀 Emoji",
							value: blockQuote(
								[
									`${inlineCode("Emoji:")}  ${bold(fullReaction.emoji.toString())}`,
									`${inlineCode("Name:")}   ${bold(fullReaction.emoji.name ?? "Unknown")}`,
									`${inlineCode("Count:")}  ${bold(String(fullReaction.count))}`,
									...(fullReaction.emoji.id
										? [`${inlineCode("ID:")}     ${inlineCode(fullReaction.emoji.id)}`]
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
							inline: false,
						},
						{
							name: "🕐 At",
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
