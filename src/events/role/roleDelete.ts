import {
	AuditLogEvent,
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	inlineCode,
	type Role,
	TimestampStyles,
	time,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:roleDelete");

const formatPermissions = (role: Role): string => {
	const perms = role.permissions.toArray();
	if (perms.length === 0) return bold("None");
	return perms.slice(0, 8).join(", ") + (perms.length > 8 ? ` …+${perms.length - 8} more` : "");
};

defineEvent({
	name: "roleDelete",
	once: false,
	execute: async (role: Role) => {
		const logChannel = await getAuditLogChannel(role.guild, "role");
		if (!logChannel) return;

		log.debug({ guildId: role.guild.id, roleId: role.id }, `Role deleted: ${role.name}`);

		const executor = await role.guild
			.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 })
			.then((audit) => audit.entries.first()?.executor ?? null)
			.catch(() => null);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("🗑️ Role Deleted")
					.setDescription(`The role **@${role.name}** has been permanently deleted.`)
					.setColor(Colors.Red)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Name:")}      ${bold(role.name)}`,
									`${inlineCode("ID:")}        ${inlineCode(role.id)}`,
									`${inlineCode("Color:")}     ${bold(role.hexColor)}`,
									`${inlineCode("Position:")}  ${bold(String(role.position))}`,
									`${inlineCode("Hoisted:")}   ${bold(role.hoist ? "Yes" : "No")}`,
									`${inlineCode("Mentionable:")} ${bold(role.mentionable ? "Yes" : "No")}`,
									`${inlineCode("Managed:")}   ${bold(role.managed ? "Yes (integration)" : "No")}`,
								].join("\n"),
							),
							inline: true,
						},
						{
							name: "🛡️ Deleted By",
							value: blockQuote(
								executor
									? `${inlineCode("User:")} ${bold(executor.tag ?? executor.id)}\n${inlineCode("ID:")}   ${inlineCode(executor.id)}`
									: `${inlineCode("User:")} ${bold("Unknown")}`,
							),
							inline: true,
						},
						{
							name: "🔒 Permissions",
							value: blockQuote(formatPermissions(role)),
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
					.setFooter({ text: `Zen • Role Logs  •  ID: ${role.id}` })
					.setTimestamp(),
			],
		});
	},
});
