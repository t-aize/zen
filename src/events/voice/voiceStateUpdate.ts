import {
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	strikethrough,
	TimestampStyles,
	time,
	userMention,
	type VoiceState,
} from "discord.js";
import { defineEvent } from "@/events/index.js";
import { getAuditLogChannel } from "@/utils/auditLog.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("event:voiceStateUpdate");

const resolveAction = (oldState: VoiceState, newState: VoiceState): { title: string; color: number } => {
	const joined = !oldState.channelId && !!newState.channelId;
	const left = !!oldState.channelId && !newState.channelId;
	const moved = !!oldState.channelId && !!newState.channelId && oldState.channelId !== newState.channelId;

	if (joined) return { title: "🔊 Member Joined Voice", color: Colors.Green };
	if (left) return { title: "🔇 Member Left Voice", color: Colors.Red };
	if (moved) return { title: "🔀 Member Moved Voice", color: Colors.Blue };
	return { title: "🔊 Voice State Updated", color: Colors.Yellow };
};

defineEvent({
	name: "voiceStateUpdate",
	once: false,
	execute: async (oldState: VoiceState, newState: VoiceState) => {
		const logChannel = await getAuditLogChannel(newState.guild, "voice");
		if (!logChannel) return;

		const member = newState.member ?? oldState.member;
		if (!member) return;

		const { title, color } = resolveAction(oldState, newState);

		log.debug(
			{
				guildId: newState.guild.id,
				userId: member.id,
				oldChannel: oldState.channelId,
				newChannel: newState.channelId,
			},
			`Voice state update: ${member.user.tag}`,
		);

		const stateChanges: string[] = [];

		if (oldState.mute !== newState.mute)
			stateChanges.push(`${inlineCode("Server Mute:")} ${bold(newState.mute ? "Muted" : "Unmuted")}`);
		if (oldState.deaf !== newState.deaf)
			stateChanges.push(`${inlineCode("Server Deaf:")} ${bold(newState.deaf ? "Deafened" : "Undeafened")}`);
		if (oldState.selfMute !== newState.selfMute)
			stateChanges.push(`${inlineCode("Self Mute:")}   ${bold(newState.selfMute ? "Muted" : "Unmuted")}`);
		if (oldState.selfDeaf !== newState.selfDeaf)
			stateChanges.push(`${inlineCode("Self Deaf:")}   ${bold(newState.selfDeaf ? "Deafened" : "Undeafened")}`);
		if (oldState.selfVideo !== newState.selfVideo)
			stateChanges.push(`${inlineCode("Camera:")}      ${bold(newState.selfVideo ? "Enabled" : "Disabled")}`);
		if (oldState.streaming !== newState.streaming)
			stateChanges.push(`${inlineCode("Streaming:")}   ${bold(newState.streaming ? "Started" : "Stopped")}`);
		if (oldState.suppress !== newState.suppress)
			stateChanges.push(`${inlineCode("Suppressed:")}  ${bold(newState.suppress ? "Yes" : "No")}`);

		const fields = [
			{
				name: "👤 Member",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(member.user.tag)}`,
						`${inlineCode("ID:")}   ${inlineCode(member.id)}`,
						`${inlineCode("Mention:")} ${userMention(member.id)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🔊 Channel",
				value: blockQuote(
					oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId
						? [
								`${inlineCode("From:")} ${channelMention(oldState.channelId)} ${strikethrough(oldState.channel?.name ?? oldState.channelId)}`,
								`${inlineCode("To:")}   ${channelMention(newState.channelId)} ${bold(newState.channel?.name ?? newState.channelId)}`,
							].join("\n")
						: newState.channelId
							? `${inlineCode("Channel:")} ${channelMention(newState.channelId)} ${bold(newState.channel?.name ?? newState.channelId)}`
							: oldState.channelId
								? `${inlineCode("Left:")} ${bold(oldState.channel?.name ?? oldState.channelId)} (${inlineCode(oldState.channelId)})`
								: bold("Unknown"),
				),
				inline: true,
			},
		];

		if (stateChanges.length > 0) {
			fields.push({
				name: `📝 State Changes (${stateChanges.length})`,
				value: blockQuote(stateChanges.join("\n")),
				inline: false,
			});
		}

		fields.push({
			name: "🕐 At",
			value: blockQuote(
				`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
			),
			inline: false,
		});

		await logChannel.send({
			embeds: [
				new EmbedBuilder()
					.setTitle(title)
					.setDescription(`${userMention(member.id)}'s voice state has changed.`)
					.setThumbnail(member.displayAvatarURL())
					.setColor(color)
					.addFields(...fields)
					.setFooter({ text: `Zen • Voice Logs  •  ID: ${member.id}` })
					.setTimestamp(),
			],
		});
	},
});
