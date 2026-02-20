import { blockQuote, bold, Colors, EmbedBuilder, inlineCode, TimestampStyles, time, userMention } from "discord.js";
import { db } from "@/db/index.js";
import { guilds } from "@/db/schema/index.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:userUpdate");

defineEvent({
	name: "userUpdate",
	once: false,
	execute: async (oldUser, newUser) => {
		const changes: { name: string; value: string }[] = [];

		if (oldUser.username !== newUser.username) {
			changes.push({
				name: "📝 Username Changed",
				value: blockQuote(
					`${inlineCode("Before:")} ${bold(oldUser.username ?? "Unknown")}\n${inlineCode("After:")}  ${bold(newUser.username)}`,
				),
			});
		}

		if (oldUser.discriminator !== newUser.discriminator) {
			changes.push({
				name: "🔢 Discriminator Changed",
				value: blockQuote(
					`${inlineCode("Before:")} ${bold(`#${oldUser.discriminator ?? "0000"}`)}\n${inlineCode("After:")}  ${bold(`#${newUser.discriminator}`)}`,
				),
			});
		}

		const oldAvatar = oldUser.avatar;
		const newAvatar = newUser.avatar;
		if (oldAvatar !== newAvatar) {
			changes.push({
				name: "🖼️ Avatar Changed",
				value: blockQuote(bold("Avatar has been updated.")),
			});
		}

		if (changes.length === 0) return;

		log.debug({ userId: newUser.id, changes: changes.map((c) => c.name) }, `User updated: ${newUser.tag}`);

		const allGuilds = await db
			.select()
			.from(guilds)
			.catch(() => []);

		for (const guild of allGuilds) {
			const discordGuild = newUser.client.guilds.cache.get(guild.id);
			if (!discordGuild) continue;

			const member = discordGuild.members.cache.get(newUser.id);
			if (!member) continue;

			const logChannel = await getAuditLogChannel(discordGuild, "member");
			if (!logChannel) continue;

			await logChannel.send({
				embeds: [
					new EmbedBuilder()
						.setTitle("👤 User Updated")
						.setDescription(`${userMention(newUser.id)}'s Discord account has been updated.`)
						.setColor(Colors.Blurple)
						.setThumbnail(newUser.displayAvatarURL({ size: 128 }))
						.addFields(
							{
								name: "👤 User",
								value: blockQuote(
									[
										`${inlineCode("Username:")} ${bold(newUser.tag)}`,
										`${inlineCode("ID:")}       ${inlineCode(newUser.id)}`,
										`${inlineCode("Created:")}  ${time(newUser.createdAt, TimestampStyles.ShortDate)} (${time(newUser.createdAt, TimestampStyles.RelativeTime)})`,
									].join("\n"),
								),
								inline: false,
							},
							...changes.map((c) => ({ name: c.name, value: c.value, inline: false })),
						)
						.setFooter({ text: `Zen • Member Logs  •  ID: ${newUser.id}` })
						.setTimestamp(),
				],
			});
		}
	},
});
