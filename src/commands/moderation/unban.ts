import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	inlineCode,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";
import { createLogger } from "@/utils/logger.js";

const UNBAN_CONFIRM_ID = "unban:confirm";
const UNBAN_CANCEL_ID = "unban:cancel";

const log = createLogger("unban");

const buildPreviewEmbed = (
	targetTag: string,
	targetId: string,
	reason: string,
	executorTag: string,
	executorId: string,
) =>
	new EmbedBuilder()
		.setTitle("🔓 Member Unban")
		.setDescription(
			`You are about to lift the ban on ${userMention(targetId)}.\n${bold("The member will be able to rejoin the server with a new invite.")}`,
		)
		.setColor(Colors.Yellow)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(targetTag)}`,
						`${inlineCode("ID:")}   ${inlineCode(targetId)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(executorTag)}`,
						`${inlineCode("ID:")}   ${inlineCode(executorId)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "📝 Reason",
				value: blockQuote(bold(reason)),
				inline: false,
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

const buildResultEmbed = (targetTag: string, targetId: string, reason: string, executorTag: string, startedAt: Date) =>
	new EmbedBuilder()
		.setTitle("✅ Member Unbanned")
		.setDescription(`${userMention(targetId)} has been successfully unbanned from the server.`)
		.setColor(Colors.Green)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(targetTag)}`,
						`${inlineCode("ID:")}   ${inlineCode(targetId)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					[
						`${inlineCode("User:")}     ${bold(executorTag)}`,
						`${inlineCode("Duration:")} ${bold(`${Date.now() - startedAt.getTime()}ms`)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "📝 Reason",
				value: blockQuote(bold(reason)),
				inline: false,
			},
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

const buildConfirmRow = (disabled = false) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(UNBAN_CONFIRM_ID)
			.setLabel("Confirm Unban")
			.setEmoji("🔓")
			.setStyle(ButtonStyle.Success)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(UNBAN_CANCEL_ID)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

defineCommand({
	data: new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Lift the ban of a previously banned user.")
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setNSFW(false)
		.addStringOption((opt) =>
			opt
				.setName("user")
				.setDescription("The banned user (type a name or ID).")
				.setRequired(true)
				.setAutocomplete(true),
		)
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the unban (shown in audit log).")
				.setMaxLength(512)
				.setRequired(false),
		),

	autocomplete: async (interaction) => {
		if (!interaction.inCachedGuild()) {
			await interaction.respond([]);
			return;
		}

		const focused = interaction.options.getFocused().toLowerCase().trim();

		try {
			const bans = await interaction.guild.bans.fetch();
			const results = bans
				.filter(
					(ban) =>
						ban.user.tag.toLowerCase().includes(focused) ||
						ban.user.id.includes(focused) ||
						ban.user.username.toLowerCase().includes(focused),
				)
				.first(25)
				.map((ban) => ({
					name: `${ban.user.tag} (${ban.user.id})`,
					value: ban.user.id,
				}));

			await interaction.respond(results);
		} catch {
			await interaction.respond([]);
		}
	},

	execute: async (interaction) => {
		if (!interaction.inCachedGuild()) {
			await interaction.reply({
				content: blockQuote(`⛔ ${bold("Server only")} — This command cannot be used in DMs.`),
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const targetId = interaction.options.getString("user", true).trim();
		const reason = interaction.options.getString("reason") ?? "No reason provided.";
		const executor = interaction.member;

		const ban = await interaction.guild.bans.fetch(targetId).catch(() => null);

		if (!ban) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("User not banned")} — No active ban found for ${inlineCode(targetId)}.\nDouble-check the ID or use the autocomplete to pick from the ban list.`,
				),
			});
			return;
		}

		const targetTag = ban.user.tag;

		const message = await interaction.editReply({
			embeds: [buildPreviewEmbed(targetTag, targetId, reason, executor.user.tag, executor.id)],
			components: [buildConfirmRow()],
		});

		const collector = message.createMessageComponentCollector({
			filter: (btn) => btn.user.id === interaction.user.id,
			max: 1,
			time: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();

			if (btn.customId === UNBAN_CANCEL_ID) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("🚫 Cancelled")
							.setDescription("The unban was cancelled. No action was taken.")
							.setColor(Colors.Grey)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
					components: [],
				});
				return;
			}

			const startedAt = new Date();

			try {
				await interaction.guild.members.unban(targetId, `[Zen] Unbanned by ${executor.user.tag}: ${reason}`);
			} catch (err) {
				log.error({ err, targetId, executorId: executor.id }, "Failed to unban user");
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("❌ Unban Failed")
							.setDescription("An unexpected error occurred while unbanning the user.")
							.setColor(Colors.Red)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
					components: [],
				});
				return;
			}

			log.info({ targetId, executorId: executor.id, reason }, `${executor.user.tag} unbanned ${targetTag}`);

			await interaction.editReply({
				embeds: [buildResultEmbed(targetTag, targetId, reason, executor.user.tag, startedAt)],
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
									"The confirmation prompt expired after 30 seconds. No action was taken.",
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
