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

const log = createLogger("event:guildMemberUpdate");

defineEvent({
	name: "guildMemberUpdate",
	once: false,
	execute: async (oldMember, newMember) => {
		const logChannel = await getAuditLogChannel(newMember.guild, "member");
		if (!logChannel) return;

		const changes: { name: string; value: string }[] = [];

		const oldNick = oldMember.nickname ?? "None";
		const newNick = newMember.nickname ?? "None";
		if (oldNick !== newNick) {
			changes.push({
				name: "✏️ Nickname Changed",
				value: blockQuote(
					`${inlineCode("Before:")} ${bold(oldNick)}\n${inlineCode("After:")}  ${bold(newNick)}`,
				),
			});
		}

		const oldRoles = "cache" in oldMember.roles ? new Set(oldMember.roles.cache.keys()) : new Set<string>();
		const newRoles = new Set(newMember.roles.cache.keys());

		const addedRoles = [...newRoles].filter((id) => !oldRoles.has(id) && id !== newMember.guild.id);
		const removedRoles = [...oldRoles].filter((id) => !newRoles.has(id) && id !== newMember.guild.id);

		if (addedRoles.length > 0) {
			const names = addedRoles.map((id) => newMember.guild.roles.cache.get(id)?.name ?? id);
			changes.push({
				name: `➕ Roles Added (${addedRoles.length})`,
				value: blockQuote(bold(names.join(", "))),
			});
		}

		if (removedRoles.length > 0) {
			const names = removedRoles.map((id) => newMember.guild.roles.cache.get(id)?.name ?? id);
			changes.push({
				name: `➖ Roles Removed (${removedRoles.length})`,
				value: blockQuote(bold(names.join(", "))),
			});
		}

		const oldTimeout = oldMember.communicationDisabledUntil;
		const newTimeout = newMember.communicationDisabledUntil;
		const timeoutChanged =
			(oldTimeout === null) !== (newTimeout === null) ||
			(oldTimeout && newTimeout && oldTimeout.getTime() !== newTimeout.getTime());

		if (timeoutChanged) {
			if (newTimeout && newTimeout > new Date()) {
				changes.push({
					name: "🔇 Timed Out",
					value: blockQuote(
						`${inlineCode("Until:")} ${time(newTimeout, TimestampStyles.FullDateShortTime)} (${time(newTimeout, TimestampStyles.RelativeTime)})`,
					),
				});
			} else if (!newTimeout) {
				changes.push({
					name: "🔊 Timeout Removed",
					value: blockQuote(bold("Member can now communicate again.")),
				});
			}
		}

		if (changes.length === 0) return;

		log.debug(
			{ guildId: newMember.guild.id, userId: newMember.id, changes: changes.map((c) => c.name) },
			`Member updated: ${newMember.user.tag}`,
		);

		const executor = await newMember.guild
			.fetchAuditLogs({ type: AuditLogEvent.MemberUpdate, limit: 1 })
			.then((audit) => {
				const entry = audit.entries.first();
				if (!entry || !entry.target) return null;
				if (entry.target.id !== newMember.id) return null;
				if (Date.now() - entry.createdTimestamp > 5_000) return null;
				return entry.executor ?? null;
			})
			.catch(() => null);

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle("✏️ Member Updated")
					.setDescription(`${userMention(newMember.id)}'s profile has been updated.`)
					.setColor(Colors.Yellow)
					.setThumbnail(newMember.user.displayAvatarURL({ size: 128 }))
					.addFields(
						{
							name: "👤 User",
							value: blockQuote(
								[
									`${inlineCode("Username:")} ${bold(newMember.user.tag)}`,
									`${inlineCode("ID:")}       ${inlineCode(newMember.id)}`,
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
						...changes.map((c) => ({ name: c.name, value: c.value, inline: false })),
					)
					.setFooter({ text: `Zen • Member Logs  •  ID: ${newMember.id}` })
					.setTimestamp(),
			],
		});
	},
});
