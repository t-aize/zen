import { blockQuote, bold, Colors, channelMention, EmbedBuilder, inlineCode, TimestampStyles, time } from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:webhooksUpdate");

defineEvent({
	name: "webhooksUpdate",
	once: false,
	execute: async (channel) => {
		const logChannel = await getAuditLogChannel(channel.guild, "channel");
		if (!logChannel) return;

		log.debug({ guildId: channel.guild.id, channelId: channel.id }, `Webhooks updated in #${channel.name}`);

		const webhooks = await channel.fetchWebhooks().catch(() => null);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🔗 Webhooks Updated")
					.setDescription(
						`The webhooks in ${channelMention(channel.id)} have been created, modified or deleted.`,
					)
					.setColor(Colors.Orange)
					.addFields(
						{
							name: "📋 Channel",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(channel.id)}`,
									`${inlineCode("ID:")}      ${inlineCode(channel.id)}`,
									`${inlineCode("Name:")}    ${bold(channel.name)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "🔗 Webhooks",
							value: blockQuote(
								webhooks === null
									? bold("Could not fetch webhooks (missing permissions)")
									: webhooks.size === 0
										? bold("No webhooks in this channel")
										: webhooks
												.first(5)
												.map((w) =>
													[
														`${inlineCode("Name:")}    ${bold(w.name ?? "Unnamed")}`,
														`${inlineCode("ID:")}      ${inlineCode(w.id)}`,
														w.owner
															? `${inlineCode("Created by:")} ${bold("tag" in w.owner ? (w.owner.tag ?? w.owner.id) : w.owner.id)}`
															: null,
													]
														.filter(Boolean)
														.join("\n"),
												)
												.join("\n\n")
												.concat(webhooks.size > 5 ? `\n…and ${webhooks.size - 5} more` : ""),
							),
							inline: true,
						},
						{
							name: "🕐 Updated At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
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
