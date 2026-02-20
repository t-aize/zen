import { blockQuote, bold, Colors, channelMention, EmbedBuilder, inlineCode, TimestampStyles, time } from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:messageDeleteBulk");

defineEvent({
	name: "messageDeleteBulk",
	once: false,
	execute: async (messages, channel) => {
		const logChannel = await getAuditLogChannel(channel.guild, "message");
		if (!logChannel) return;

		log.debug(
			{ guildId: channel.guild.id, channelId: channel.id, count: messages.size },
			`Bulk delete: ${messages.size} messages in #${channel.name}`,
		);

		const authors = new Map<string, { tag: string; count: number }>();
		for (const msg of messages.values()) {
			if (!msg.author) continue;
			const entry = authors.get(msg.author.id);
			if (entry) {
				entry.count++;
			} else {
				authors.set(msg.author.id, { tag: msg.author.tag, count: 1 });
			}
		}

		const authorSummary =
			authors.size === 0
				? bold("Unknown (messages not cached)")
				: [...authors.entries()]
						.sort((a, b) => b[1].count - a[1].count)
						.slice(0, 8)
						.map(
							([id, { tag, count }]) =>
								`${bold(tag)} ${inlineCode(id)} — ${bold(String(count))} msg${count > 1 ? "s" : ""}`,
						)
						.join("\n") + (authors.size > 8 ? `\n…+${authors.size - 8} more` : "");

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🗑️ Bulk Delete")
					.setDescription(
						`${bold(String(messages.size))} messages were deleted at once in ${channelMention(channel.id)}.`,
					)
					.setColor(Colors.DarkRed)
					.addFields(
						{
							name: "📍 Channel",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(channel.id)}`,
									`${inlineCode("ID:")}      ${inlineCode(channel.id)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📊 Stats",
							value: blockQuote(
								[
									`${inlineCode("Deleted:")} ${bold(String(messages.size))} messages`,
									`${inlineCode("Cached:")}  ${bold(String([...messages.values()].filter((m) => m.content !== null).length))} / ${messages.size}`,
									`${inlineCode("Authors:")} ${bold(String(authors.size))} unique`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "👥 Authors",
							value: blockQuote(authorSummary),
							inline: false,
						},
						{
							name: "🕐 Deleted At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Message Logs  •  Channel: ${channel.id}` })
					.setTimestamp(),
			],
		});
	},
});
