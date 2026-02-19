import {
	AuditLogEvent,
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	type StageInstance,
	strikethrough,
	TimestampStyles,
	time,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:stageInstanceUpdate");

const PRIVACY_LABEL: Record<number, string> = {
	1: "Guild Only",
	2: "Public",
};

defineEvent({
	name: "stageInstanceUpdate",
	once: false,
	execute: async (oldStage: StageInstance | null, newStage: StageInstance) => {
		if (!newStage.guild) return;

		const logChannel = await getAuditLogChannel(newStage.guild, "voice");
		if (!logChannel) return;

		log.debug({ guildId: newStage.guild.id, stageId: newStage.id }, `Stage instance updated: ${newStage.topic}`);

		const executor = await newStage.guild
			.fetchAuditLogs({ type: AuditLogEvent.StageInstanceUpdate, limit: 1 })
			.then((audit) => audit.entries.first()?.executor ?? null)
			.catch(() => null);

		const changes: string[] = [];

		if (oldStage?.topic !== newStage.topic)
			changes.push(
				`${inlineCode("Topic:")}   ${strikethrough(oldStage?.topic ?? "None")} → ${bold(newStage.topic)}`,
			);

		if (oldStage?.privacyLevel !== newStage.privacyLevel)
			changes.push(
				`${inlineCode("Privacy:")} ${bold(PRIVACY_LABEL[oldStage?.privacyLevel ?? 0] ?? "Unknown")} → ${bold(PRIVACY_LABEL[newStage.privacyLevel] ?? String(newStage.privacyLevel))}`,
			);

		if (changes.length === 0) return;

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("✏️ Stage Updated")
					.setDescription(`The stage session in ${channelMention(newStage.channelId)} has been updated.`)
					.setColor(Colors.Yellow)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Topic:")}   ${bold(newStage.topic)}`,
									`${inlineCode("ID:")}      ${inlineCode(newStage.id)}`,
									`${inlineCode("Channel:")} ${channelMention(newStage.channelId)}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "🛡️ Updated By",
							value: blockQuote(
								executor
									? `${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`
									: `${inlineCode("User:")} ${bold("Unknown")}`,
							),
							inline: true,
						},
						{
							name: `📝 Changes (${changes.length})`,
							value: blockQuote(changes.join("\n")),
							inline: false,
						},
						{
							name: "🕐 Updated At",
							value: blockQuote(
								`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Voice Logs  •  ID: ${newStage.id}` })
					.setTimestamp(),
			],
		});
	},
});
