import {
	AuditLogEvent,
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	type StageInstance,
	TimestampStyles,
	time,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:stageInstanceCreate");

const PRIVACY_LABEL: Record<number, string> = {
	1: "Guild Only",
	2: "Public",
};

defineEvent({
	name: "stageInstanceCreate",
	once: false,
	execute: async (stageInstance: StageInstance) => {
		if (!stageInstance.guild) return;

		const logChannel = await getAuditLogChannel(stageInstance.guild, "voice");
		if (!logChannel) return;

		log.debug(
			{ guildId: stageInstance.guild.id, stageId: stageInstance.id, channelId: stageInstance.channelId },
			`Stage instance created: ${stageInstance.topic}`,
		);

		const executor = await stageInstance.guild
			.fetchAuditLogs({ type: AuditLogEvent.StageInstanceCreate, limit: 1 })
			.then((audit) => audit.entries.first()?.executor ?? null)
			.catch(() => null);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🎙️ Stage Started")
					.setDescription(`A new stage session has started in ${channelMention(stageInstance.channelId)}.`)
					.setColor(Colors.Green)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Topic:")}   ${bold(stageInstance.topic)}`,
									`${inlineCode("ID:")}      ${inlineCode(stageInstance.id)}`,
									`${inlineCode("Channel:")} ${channelMention(stageInstance.channelId)}`,
									`${inlineCode("Privacy:")} ${bold(PRIVACY_LABEL[stageInstance.privacyLevel] ?? String(stageInstance.privacyLevel))}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "🛡️ Started By",
							value: blockQuote(
								executor
									? `${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`
									: `${inlineCode("User:")} ${bold("Unknown")}`,
							),
							inline: true,
						},
						{
							name: "🕐 Started At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Voice Logs  •  ID: ${stageInstance.id}` })
					.setTimestamp(),
			],
		});
	},
});
