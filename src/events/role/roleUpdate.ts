import {
	AuditLogEvent,
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	inlineCode,
	type Role,
	roleMention,
	strikethrough,
	TimestampStyles,
	time,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:roleUpdate");

const diff = (label: string, before: unknown, after: unknown): string | null => {
	const b = String(before ?? "None");
	const a = String(after ?? "None");
	if (b === a) return null;
	return `${inlineCode(label)} ${strikethrough(b)} → ${bold(a)}`;
};

const formatPermDiff = (oldRole: Role, newRole: Role): string[] => {
	const added = newRole.permissions.toArray().filter((p) => !oldRole.permissions.has(p));
	const removed = oldRole.permissions.toArray().filter((p) => !newRole.permissions.has(p));
	const lines: string[] = [];
	if (added.length > 0) lines.push(`${inlineCode("Added:")}   ${bold(added.join(", "))}`);
	if (removed.length > 0) lines.push(`${inlineCode("Removed:")} ${strikethrough(removed.join(", "))}`);
	return lines;
};

defineEvent({
	name: "roleUpdate",
	once: false,
	execute: async (oldRole, newRole) => {
		const logChannel = await getAuditLogChannel(newRole.guild, "role");
		if (!logChannel) return;

		log.debug({ guildId: newRole.guild.id, roleId: newRole.id }, `Role updated: ${newRole.name}`);

		const executor = await newRole.guild
			.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 })
			.then((audit) => audit.entries.first()?.executor ?? null)
			.catch(() => null);

		const changes: string[] = [
			diff("Name:", oldRole.name, newRole.name),
			diff("Color:", oldRole.hexColor, newRole.hexColor),
			diff("Position:", oldRole.position, newRole.position),
			oldRole.hoist !== newRole.hoist
				? `${inlineCode("Hoisted:")}     ${bold(oldRole.hoist ? "Yes" : "No")} → ${bold(newRole.hoist ? "Yes" : "No")}`
				: null,
			oldRole.mentionable !== newRole.mentionable
				? `${inlineCode("Mentionable:")} ${bold(oldRole.mentionable ? "Yes" : "No")} → ${bold(newRole.mentionable ? "Yes" : "No")}`
				: null,
			...formatPermDiff(oldRole, newRole),
		].filter(Boolean) as string[];

		if (changes.length === 0) return;

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("✏️ Role Updated")
					.setDescription(`${roleMention(newRole.id)} has been modified.`)
					.setColor(newRole.color !== 0 ? newRole.color : Colors.Yellow)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Name:")} ${bold(newRole.name)}`,
									`${inlineCode("ID:")}   ${inlineCode(newRole.id)}`,
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
					.setFooter({ text: `Zen • Role Logs  •  ID: ${newRole.id}` })
					.setTimestamp(),
			],
		});
	},
});
