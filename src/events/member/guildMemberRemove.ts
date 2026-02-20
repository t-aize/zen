import {
	AuditLogEvent,
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	inlineCode,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:guildMemberRemove");

defineEvent({
	name: "guildMemberRemove",
	once: false,
	execute: async (member) => {
		const logChannel = await getAuditLogChannel(member.guild, "member");
		if (!logChannel) return;

		log.debug({ guildId: member.guild.id, userId: member.id }, `Member left: ${member.user?.tag ?? member.id}`);

		const executor = await member.guild
			.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 })
			.then((audit) => {
				const entry = audit.entries.first();
				if (!entry || !entry.target) return null;
				if (entry.target.id !== member.id) return null;
				if (Date.now() - entry.createdTimestamp > 5_000) return null;
				return entry.executor ?? null;
			})
			.catch(() => null);

		const roles =
			member.roles && "cache" in member.roles
				? [...member.roles.cache.values()]
						.filter((r) => r.id !== member.guild.id)
						.slice(0, 10)
						.map((r) => r.name)
				: [];

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle(executor ? "👢 Member Kicked" : "📤 Member Left")
					.setDescription(
						executor
							? `${userMention(member.id)} was kicked from the server by ${userMention(executor.id)}.`
							: `${userMention(member.id)} has left the server.`,
					)
					.setColor(executor ? Colors.Orange : Colors.Grey)
					.setThumbnail(member.user?.displayAvatarURL({ size: 128 }) ?? null)
					.addFields(
						{
							name: "👤 User",
							value: blockQuote(
								[
									`${inlineCode("Username:")} ${bold(member.user?.tag ?? "Unknown")}`,
									`${inlineCode("ID:")}       ${inlineCode(member.id)}`,
								].join("\n"),
							),
							inline: true,
						},
						...(executor
							? [
									{
										name: "🛡️ Kicked By",
										value: blockQuote(
											`${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`,
										),
										inline: true,
									},
								]
							: []),
						...(member.joinedAt
							? [
									{
										name: "📅 Was Member Since",
										value: blockQuote(
											`${time(member.joinedAt, TimestampStyles.FullDateShortTime)} (${time(member.joinedAt, TimestampStyles.RelativeTime)})`,
										),
										inline: false,
									},
								]
							: []),
						...(roles.length > 0
							? [
									{
										name: `🎭 Roles (${roles.length})`,
										value: blockQuote(
											roles.join(", ") +
												(member.roles &&
												"cache" in member.roles &&
												member.roles.cache.size - 1 > 10
													? ` …+${member.roles.cache.size - 11} more`
													: ""),
										),
										inline: false,
									},
								]
							: []),
						{
							name: "👥 Server",
							value: blockQuote(
								`${inlineCode("Member count:")} ${bold(String(member.guild.memberCount))}`,
							),
							inline: false,
						},
					)
					.setFooter({ text: `Zen • Member Logs  •  ID: ${member.id}` })
					.setTimestamp(),
			],
		});
	},
});
