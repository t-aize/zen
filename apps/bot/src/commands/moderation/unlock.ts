import {
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	OverwriteType,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type TextChannel,
} from "discord.js";
import { defineCommand } from "@/commands";
import { createLogger } from "@/utils/logger";
import {
	ensureGuild,
	executorFieldWithDuration,
	reasonField,
} from "@/utils/moderation";

const log = createLogger("unlock");

defineCommand({
	data: new SlashCommandBuilder()
		.setName("unlock")
		.setDescription(
			"Unlock a channel — restore @everyone's ability to send messages.",
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.setNSFW(false)
		.addChannelOption((opt) =>
			opt
				.setName("channel")
				.setDescription("Channel to unlock (defaults to current).")
				.setRequired(false),
		)
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for unlocking the channel.")
				.setMaxLength(512)
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const targetChannel = (interaction.options.getChannel("channel") ??
			interaction.channel) as TextChannel | null;
		const reason =
			interaction.options.getString("reason") ?? "No reason provided.";

		if (!targetChannel || !("permissionOverwrites" in targetChannel)) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Invalid channel")} — Could not resolve a valid text channel.`,
				),
			});
			return;
		}

		const everyoneRole = interaction.guild.roles.everyone;
		const currentOverwrite = targetChannel.permissionOverwrites.cache.get(
			everyoneRole.id,
		);
		const isLocked =
			currentOverwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

		if (!isLocked) {
			await interaction.editReply({
				content: blockQuote(
					`ℹ️ ${bold("Not locked")} — ${channelMention(targetChannel.id)} is not currently locked.`,
				),
			});
			return;
		}

		const startedAt = new Date();

		try {
			await targetChannel.permissionOverwrites.edit(
				everyoneRole,
				{
					SendMessages: null,
					AddReactions: null,
					CreatePublicThreads: null,
					CreatePrivateThreads: null,
				},
				{
					reason: `[Zen] Unlocked by ${interaction.user.tag}: ${reason}`,
					type: OverwriteType.Role,
				},
			);
		} catch (err) {
			log.error(
				{ err, channelId: targetChannel.id },
				"Failed to unlock channel",
			);
			await interaction.editReply({
				content: blockQuote(
					`❌ ${bold("Failed")} — An unexpected error occurred while unlocking the channel.`,
				),
			});
			return;
		}

		log.info(
			{ channelId: targetChannel.id, executorId: interaction.user.id, reason },
			`${interaction.user.tag} unlocked #${targetChannel.name}`,
		);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("🔓 Channel Unlocked")
					.setDescription(
						`${channelMention(targetChannel.id)} has been unlocked.`,
					)
					.setColor(Colors.Green)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(targetChannel.id)}`,
									`${inlineCode("Restored:")} ${bold("SendMessages, AddReactions, CreateThreads")}`,
								].join("\n"),
							),
							inline: true,
						},
						executorFieldWithDuration(interaction.user, startedAt),
						reasonField(reason),
					)
					.setFooter({ text: "Zen • Moderation" })
					.setTimestamp(),
			],
		});

		await targetChannel
			.send({
				embeds: [
					new EmbedBuilder()
						.setTitle("🔓 Channel Unlocked")
						.setDescription(
							`This channel has been unlocked by ${interaction.user}.\n${bold("Members can now send messages again.")}`,
						)
						.setColor(Colors.Green)
						.addFields(reasonField(reason))
						.setFooter({ text: "Zen • Moderation" })
						.setTimestamp(),
				],
			})
			.catch(() => null);
	},
});
