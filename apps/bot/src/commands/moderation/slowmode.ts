import {
	blockQuote,
	bold,
	Colors,
	channelMention,
	EmbedBuilder,
	type GuildTextBasedChannel,
	inlineCode,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import { defineCommand } from "@/commands";
import { createLogger } from "@/utils/logger";
import { ensureGuild, executorFieldWithDuration } from "@/utils/moderation";

const log = createLogger("slowmode");

const formatDuration = (seconds: number): string => {
	if (seconds === 0) return "Off";
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3_600) return `${Math.floor(seconds / 60)}m`;
	return `${Math.floor(seconds / 3_600)}h`;
};

defineCommand({
	data: new SlashCommandBuilder()
		.setName("slowmode")
		.setDescription("Set the slowmode delay for a channel.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
		.setNSFW(false)
		.addIntegerOption((opt) =>
			opt
				.setName("seconds")
				.setDescription(
					"Slowmode delay in seconds (0 to disable, max 21600 = 6h).",
				)
				.setMinValue(0)
				.setMaxValue(21_600)
				.setRequired(true),
		)
		.addChannelOption((opt) =>
			opt
				.setName("channel")
				.setDescription("Channel to set slowmode on (defaults to current).")
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const seconds = interaction.options.getInteger("seconds", true);
		const targetChannel = (interaction.options.getChannel("channel") ??
			interaction.channel) as GuildTextBasedChannel | null;

		if (!targetChannel || !("setRateLimitPerUser" in targetChannel)) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Invalid channel")} — Could not resolve a valid text channel.`,
				),
			});
			return;
		}

		const oldSlowmode =
			"rateLimitPerUser" in targetChannel
				? (targetChannel.rateLimitPerUser as number)
				: 0;
		const startedAt = new Date();

		try {
			await targetChannel.setRateLimitPerUser(
				seconds,
				`[Zen] Set by ${interaction.user.tag}`,
			);
		} catch (err) {
			log.error({ err, channelId: targetChannel.id }, "Failed to set slowmode");
			await interaction.editReply({
				content: blockQuote(
					`❌ ${bold("Failed")} — An unexpected error occurred while setting slowmode.`,
				),
			});
			return;
		}

		log.info(
			{
				channelId: targetChannel.id,
				executorId: interaction.user.id,
				oldSlowmode,
				newSlowmode: seconds,
			},
			`${interaction.user.tag} set slowmode to ${seconds}s in #${targetChannel.name}`,
		);

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle(
						seconds > 0 ? "🐌 Slowmode Updated" : "🐌 Slowmode Disabled",
					)
					.setDescription(
						seconds > 0
							? `Slowmode in ${channelMention(targetChannel.id)} has been set to ${bold(formatDuration(seconds))}.`
							: `Slowmode in ${channelMention(targetChannel.id)} has been disabled.`,
					)
					.setColor(Colors.Green)
					.addFields(
						{
							name: "📋 Details",
							value: blockQuote(
								[
									`${inlineCode("Channel:")} ${channelMention(targetChannel.id)}`,
									`${inlineCode("Before:")}  ${bold(formatDuration(oldSlowmode))}`,
									`${inlineCode("After:")}   ${bold(formatDuration(seconds))}`,
								].join("\n"),
							),
							inline: true,
						},
						executorFieldWithDuration(interaction.user, startedAt),
					)
					.setFooter({ text: "Zen • Moderation" })
					.setTimestamp(),
			],
		});

		if ("send" in targetChannel) {
			await targetChannel
				.send({
					embeds: [
						new EmbedBuilder()
							.setDescription(
								seconds > 0
									? `🐌 Slowmode has been set to **${formatDuration(seconds)}** by ${interaction.user}.`
									: `🐌 Slowmode has been **disabled** by ${interaction.user}.`,
							)
							.setColor(seconds > 0 ? Colors.Orange : Colors.Green)
							.setTimestamp(),
					],
				})
				.catch(() => null);
		}
	},
});
