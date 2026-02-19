import {
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	type TextBasedChannel,
	TimestampStyles,
	time,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:channelPinsUpdate");

defineEvent({
	name: "channelPinsUpdate",
	once: false,
	execute: async (channel: TextBasedChannel, pinDate: Date) => {
		if (!("guild" in channel) || !channel.guild) return;

		const logChannel = await getAuditLogChannel(channel.guild, "channel");
		if (!logChannel) return;

		log.debug({ guildId: channel.guild.id, channelId: channel.id }, "Channel pins updated");

		const lastPin = await channel.messages
			.fetchPins()
			.then((pins) => pins.items[0]?.message ?? null)
			.catch(() => null);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("📌 Pinned Messages Updated")
					.setDescription(`The pinned messages in ${channelMention(channel.id)} have been updated.`)
					.setColor(Colors.Blue)
					.addFields(
						{
							name: "📋 Channel",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(channel.id)}`,
									`${inlineCode("ID:")}      ${inlineCode(channel.id)}`,
								].join("\n"),
							),
							inline: true,
						},
						...(lastPin
							? [
									{
										name: "📌 Latest Pin",
										value: blockQuote(
											[
												`${inlineCode("Author:")}  ${bold(lastPin.author.tag)}`,
												`${inlineCode("Content:")} ${bold(lastPin.content ? (lastPin.content.length > 80 ? `${lastPin.content.slice(0, 80)}…` : lastPin.content) : "*(no text content)*")}`,
												`${inlineCode("Sent:")}    ${time(lastPin.createdAt, TimestampStyles.RelativeTime)}`,
												`${inlineCode("Link:")}    ${lastPin.url}`,
											].join("\n"),
										),
										inline: true,
									},
								]
							: []),
						{
							name: "🕐 Updated At",
							value: blockQuote(
								`${time(pinDate, TimestampStyles.FullDateShortTime)} (${time(pinDate, TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Channel Logs  •  ID: ${channel.id}` })
					.setTimestamp(),
			],
		});
	},
});
