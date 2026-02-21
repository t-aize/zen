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

const log = createLogger("lock");

defineCommand({
	data: new SlashCommandBuilder()
		.setName("lock")
		.setDescription("Lock a channel — prevent @everyone from sending messages.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.setNSFW(false)
		.addChannelOption((opt) =>
			opt
				.setName("channel")
				.setDescription("Channel to lock (defaults to current).")
				.setRequired(false),
		)
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for locking the channel.")
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
		const alreadyLocked =
			currentOverwrite?.deny.has(PermissionFlagsBits.SendMessages) ?? false;

		if (alreadyLocked) {
			await interaction.editReply({
				content: blockQuote(
					`ℹ️ ${bold("Already locked")} — ${channelMention(targetChannel.id)} is already locked.`,
				),
			});
			return;
		}

		const startedAt = new Date();

		try {
			await targetChannel.permissionOverwrites.edit(
				everyoneRole,
				{
					SendMessages: false,
					AddReactions: false,
					CreatePublicThreads: false,
					CreatePrivateThreads: false,
				},
				{
					reason: `[Zen] Locked by ${interaction.user.tag}: ${reason}`,
					type: OverwriteType.Role,
				},
			);
		} catch (err) {
			log.error({ err, channelId: targetChannel.id }, "Failed to lock channel");
			await interaction.editReply({
				content: blockQuote(
					`❌ ${bold("Failed")} — An unexpected error occurred while locking the channel.`,
				),
			});
			return;
		}

		log.info(
			{ channelId: targetChannel.id, executorId: interaction.user.id, reason },
			`${interaction.user.tag} locked #${targetChannel.name}`,
		);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("🔒 Channel Locked")
					.setDescription(
						`${channelMention(targetChannel.id)} has been locked.`,
					)
					.setColor(Colors.Green)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(targetChannel.id)}`,
									`${inlineCode("Denied:")}  ${bold("SendMessages, AddReactions, CreateThreads")}`,
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
						.setTitle("🔒 Channel Locked")
						.setDescription(
							`This channel has been locked by ${interaction.user}.\n${bold("Members can no longer send messages here.")}`,
						)
						.setColor(Colors.Red)
						.addFields(reasonField(reason))
						.setFooter({ text: "Zen • Moderation" })
						.setTimestamp(),
				],
			})
			.catch(() => null);
	},
});
