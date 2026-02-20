import { blockQuote, bold, Colors, EmbedBuilder, inlineCode, TimestampStyles, time, userMention } from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:guildMemberAdd");

defineEvent({
	name: "guildMemberAdd",
	once: false,
	execute: async (member) => {
		const logChannel = await getAuditLogChannel(member.guild, "member");
		if (!logChannel) return;

		log.debug({ guildId: member.guild.id, userId: member.id }, `Member joined: ${member.user.tag}`);

		const accountAge = member.user.createdAt;
		const joinedAt = member.joinedAt ?? new Date();
		const isNew = Date.now() - accountAge.getTime() < 7 * 24 * 60 * 60 * 1_000;

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("📥 Member Joined")
					.setDescription(
						`${userMention(member.id)} has joined the server.${isNew ? `\n\n⚠️ ${bold("New account — created less than 7 days ago.")}` : ""}`,
					)
					.setColor(Colors.Green)
					.setThumbnail(member.user.displayAvatarURL({ size: 128 }))
					.addFields(
						{
							name: "👤 User",
							value: blockQuote(
								[
									`${inlineCode("Username:")} ${bold(member.user.tag)}`,
									`${inlineCode("ID:")}       ${inlineCode(member.id)}`,
									`${inlineCode("Bot:")}      ${bold(member.user.bot ? "Yes" : "No")}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "📊 Account",
							value: blockQuote(
								[
									`${inlineCode("Created:")} ${time(accountAge, TimestampStyles.ShortDate)} (${time(accountAge, TimestampStyles.RelativeTime)})`,
									`${inlineCode("Joined:")}  ${time(joinedAt, TimestampStyles.ShortDate)} (${time(joinedAt, TimestampStyles.RelativeTime)})`,
								].join("\n"),
							),
							inline: true,
						},
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
