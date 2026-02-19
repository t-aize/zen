import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	blockQuote,
	bold,
	type ChatInputCommandInteraction,
	Colors,
	channelMention,
	EmbedBuilder,
	type GuildTextBasedChannel,
	inlineCode,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";

const CLEAN_CONFIRM_ID = "clear:confirm";
const CLEAN_CANCEL_ID = "clear:cancel";

/** Discord limits bulk-delete to messages younger than 14 days. */
const MAX_BULK_AGE_MS = 14 * 24 * 60 * 60 * 1_000;

/** Maximum number of messages Discord allows in a single bulk-delete. */
const BULK_DELETE_MAX = 100;

const pluralise = (n: number, word: string) => `${bold(String(n))} ${word}${n !== 1 ? "s" : ""}`;

const buildPreviewEmbed = (
	amount: number,
	target: string | null,
	channelMention: string,
	interaction: ChatInputCommandInteraction,
) => {
	const description = [
		`You are about to permanently delete ${pluralise(amount, "message")} from ${channelMention}.`,
		target ? `\nFiltered to messages from ${target}.` : "",
		`\n⚠️ ${bold("This action cannot be undone.")} Messages older than 14 days will be skipped.`,
	].join("");

	return new EmbedBuilder()
		.setTitle("🧹 Bulk Message Deletion")
		.setDescription(description)
		.setColor(Colors.Yellow)
		.addFields(
			{
				name: "📋 Parameters",
				value: blockQuote(
					[
						`${inlineCode("Amount:")} ${bold(String(amount))}`,
						`${inlineCode("Channel:")} ${channelMention}`,
						target ? `${inlineCode("Filter:")} ${target}` : `${inlineCode("Filter:")} ${bold("None")}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					`${inlineCode("User:")} ${bold(interaction.user.tag)}\n${inlineCode("ID:")} ${inlineCode(interaction.user.id)}`,
				),
				inline: true,
			},
			{
				name: "🕐 Requested At",
				value: blockQuote(
					`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
				),
				inline: false,
			},
		)
		.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
		.setTimestamp();
};

const buildResultEmbed = (
	deleted: number,
	skipped: number,
	channelMention: string,
	executorTag: string,
	startedAt: Date,
) => {
	const success = deleted > 0;

	return new EmbedBuilder()
		.setTitle(success ? "✅ Cleanup Complete" : "⚠️ Nothing Deleted")
		.setDescription(
			success
				? `Successfully purged ${pluralise(deleted, "message")} from ${channelMention}.${skipped > 0 ? `\n${pluralise(skipped, "message")} were skipped (older than 14 days).` : ""}`
				: `No eligible messages were found in ${channelMention}. All targeted messages may be older than 14 days.`,
		)
		.setColor(success ? Colors.Green : Colors.Orange)
		.addFields(
			{
				name: "📊 Summary",
				value: blockQuote(
					[
						`${inlineCode("Deleted:")} ${bold(String(deleted))}`,
						`${inlineCode("Skipped:")} ${bold(String(skipped))}`,
						`${inlineCode("Channel:")} ${channelMention}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					`${inlineCode("User:")} ${bold(executorTag)}\n${inlineCode("Duration:")} ${bold(`${Date.now() - startedAt.getTime()}ms`)}`,
				),
				inline: true,
			},
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();
};

const buildConfirmRow = (disabled = false) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(CLEAN_CONFIRM_ID)
			.setLabel("Confirm Delete")
			.setEmoji("🧹")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(CLEAN_CANCEL_ID)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

defineCommand({
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Bulk-delete messages from a channel with an optional user filter.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.setNSFW(false)
		.addIntegerOption((opt) =>
			opt
				.setName("amount")
				.setDescription("Number of messages to delete (1–100).")
				.setMinValue(1)
				.setMaxValue(BULK_DELETE_MAX)
				.setRequired(true),
		)
		.addUserOption((opt) =>
			opt.setName("user").setDescription("Only delete messages from this user (optional).").setRequired(false),
		)
		.addChannelOption((opt) =>
			opt.setName("channel").setDescription("Channel to clean (defaults to current channel).").setRequired(false),
		),

	execute: async (interaction) => {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({
				content: blockQuote(`⛔ ${bold("Server only")} — This command cannot be used in DMs.`),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const amount = interaction.options.getInteger("amount", true);
		const targetUser = interaction.options.getUser("user");
		const targetChannel = (interaction.options.getChannel("channel") ??
			interaction.channel) as GuildTextBasedChannel | null;

		if (!targetChannel || !("messages" in targetChannel)) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Invalid channel")} — Could not resolve a valid text channel.`),
			});
			return;
		}

		const message = await interaction.editReply({
			embeds: [
				buildPreviewEmbed(
					amount,
					targetUser ? userMention(targetUser?.id) : null,
					channelMention(targetChannel.id),
					interaction,
				),
			],
			components: [buildConfirmRow()],
		});

		const collector = message.createMessageComponentCollector({
			filter: (btn) => btn.user.id === interaction.user.id,
			max: 1,
			time: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();

			if (btn.customId === CLEAN_CANCEL_ID) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("🚫 Cancelled")
							.setDescription("The bulk deletion was cancelled. No messages were deleted.")
							.setColor(Colors.Grey)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
					components: [],
				});
				return;
			}

			const startedAt = new Date();

			const fetched = await targetChannel.messages.fetch({ limit: BULK_DELETE_MAX });

			const now = Date.now();
			const cutoff = now - MAX_BULK_AGE_MS;

			const eligible = fetched.filter((msg) => {
				const fresh = msg.createdTimestamp >= cutoff;
				const matchesUser = targetUser ? msg.author.id === targetUser.id : true;
				return fresh && matchesUser;
			});

			const toDelete = [...eligible.values()].slice(0, amount);
			const skipped = Math.max(0, amount - toDelete.length);

			let deleted = 0;

			if (toDelete.length > 0) {
				const bulkResult = await targetChannel.bulkDelete(toDelete, true);
				deleted = bulkResult.size;
			}

			await interaction.editReply({
				embeds: [
					buildResultEmbed(
						deleted,
						skipped,
						channelMention(targetChannel.id),
						interaction.user.tag,
						startedAt,
					),
				],
				components: [],
			});
		});

		collector.on("end", async (_, reason) => {
			if (reason === "time") {
				await interaction
					.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle("⏱️ Timed Out")
								.setDescription(
									"The confirmation prompt expired after 30 seconds. No messages were deleted.",
								)
								.setColor(Colors.Grey)
								.setFooter({ text: "Zen • Moderation" })
								.setTimestamp(),
						],
						components: [buildConfirmRow(true)],
					})
					.catch(() => null);
			}
		});
	},
});
