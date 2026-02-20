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

const log = createLogger("event:voiceChannelEffectSend");

defineEvent({
	name: "voiceChannelEffectSend",
	once: false,
	execute: async (effect) => {
		const channel = effect.channel;
		if (!channel) return;

		const logChannel = await getAuditLogChannel(channel.guild, "voice");
		if (!logChannel) return;

		log.debug(
			{ guildId: channel.guild.id, channelId: channel.id, userId: effect.userId },
			"Voice channel effect sent",
		);

		const emoji = effect.emoji;
		const emojiDisplay = emoji
			? emoji.id
				? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`
				: (emoji.name ?? "Unknown")
			: "Unknown";

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("✨ Voice Effect Sent")
					.setDescription(`A voice channel effect was used in ${channelMention(channel.id)}.`)
					.setColor(Colors.Purple)
					.addFields(
						{
							name: "👤 User",
							value: blockQuote(
								[
									`${inlineCode("Mention:")} ${userMention(effect.userId)}`,
									`${inlineCode("ID:")}      ${inlineCode(effect.userId)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "✨ Effect",
							value: blockQuote(
								[
									`${inlineCode("Emoji:")}    ${bold(emojiDisplay)}`,
									`${inlineCode("Channel:")} ${channelMention(channel.id)}`,
									`${inlineCode("Chan ID:")} ${inlineCode(channel.id)}`,
									effect.animationType !== null
										? `${inlineCode("Animation:")} ${bold(String(effect.animationType))}`
										: null,
									effect.soundId
										? `${inlineCode("Sound ID:")} ${inlineCode(String(effect.soundId))}`
										: null,
								]
									.filter(Boolean)
									.join("\n"),
							),
							inline: true,
						},
						{
							name: "🕐 At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Voice Logs  •  ID: ${channel.id}` })
					.setTimestamp(),
			],
		});
	},
});
