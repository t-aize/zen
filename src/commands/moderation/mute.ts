import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	type GuildMember,
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

const MUTE_CONFIRM_ID = "mute:confirm";
const MUTE_CANCEL_ID = "mute:cancel";

const log = createLogger("mute");

const DURATION_CHOICES = [
	{ name: "60 seconds", value: 60 },
	{ name: "5 minutes", value: 300 },
	{ name: "10 minutes", value: 600 },
	{ name: "30 minutes", value: 1_800 },
	{ name: "1 hour", value: 3_600 },
	{ name: "6 hours", value: 21_600 },
	{ name: "12 hours", value: 43_200 },
	{ name: "1 day", value: 86_400 },
	{ name: "3 days", value: 259_200 },
	{ name: "1 week", value: 604_800 },
] as const;

/** Max timeout Discord allows: 28 days */
const MAX_TIMEOUT_S = 28 * 24 * 60 * 60;

const formatDuration = (seconds: number): string => {
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3_600) return `${seconds / 60}m`;
	if (seconds < 86_400) return `${seconds / 3_600}h`;
	if (seconds < 604_800) return `${seconds / 86_400}d`;
	return `${Math.round(seconds / 604_800)}w`;
};

const getMuteBlockReason = (executor: GuildMember, target: GuildMember, me: GuildMember): string | null => {
	if (!target.moderatable) return "I don't have permission to timeout this member.";
	if (target.id === executor.id) return "You cannot mute yourself.";
	if (target.id === me.id) return "I cannot mute myself.";
	if (target.roles.highest.position >= executor.roles.highest.position)
		return "You cannot mute a member with an equal or higher role than yours.";
	return null;
};

const buildPreviewEmbed = (target: GuildMember, durationS: number, reason: string, executor: GuildMember) => {
	const until = new Date(Date.now() + durationS * 1_000);

	return new EmbedBuilder()
		.setTitle("🔇 Member Mute")
		.setDescription(
			`You are about to timeout ${userMention(target.id)} using Discord's ${bold("Timeout")} feature.\n⚠️ ${bold("The member will be unable to send messages, react, or join voice channels.")}`,
		)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Yellow)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")}     ${bold(target.user.tag)}`,
						`${inlineCode("ID:")}       ${inlineCode(target.id)}`,
						`${inlineCode("Duration:")} ${bold(formatDuration(durationS))}`,
						`${inlineCode("Until:")}    ${time(until, TimestampStyles.FullDateShortTime)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(executor.user.tag)}`,
						`${inlineCode("ID:")}   ${inlineCode(executor.id)}`,
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
};

const buildResultEmbed = (
	target: GuildMember,
	durationS: number,
	reason: string,
	executor: GuildMember,
	startedAt: Date,
) => {
	const until = new Date(Date.now() + durationS * 1_000);

	return new EmbedBuilder()
		.setTitle("✅ Member Muted")
		.setDescription(`${userMention(target.id)} has been put in timeout.`)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Green)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")}     ${bold(target.user.tag)}`,
						`${inlineCode("ID:")}       ${inlineCode(target.id)}`,
						`${inlineCode("Duration:")} ${bold(formatDuration(durationS))}`,
						`${inlineCode("Until:")}    ${time(until, TimestampStyles.FullDateShortTime)}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					[
						`${inlineCode("User:")}     ${bold(executor.user.tag)}`,
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
};

const buildConfirmRow = (disabled = false) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(MUTE_CONFIRM_ID)
			.setLabel("Confirm Mute")
			.setEmoji("🔇")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(MUTE_CANCEL_ID)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

defineCommand({
	data: new SlashCommandBuilder()
		.setName("mute")
		.setDescription("Timeout a member using Discord's native exclusion feature.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setNSFW(false)
		.addUserOption((opt) => opt.setName("user").setDescription("The member to mute.").setRequired(true))
		.addIntegerOption((opt) =>
			opt
				.setName("duration")
				.setDescription("Timeout duration.")
				.setRequired(true)
				.addChoices(...DURATION_CHOICES),
		)
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the mute (shown in audit log).")
				.setMaxLength(512)
				.setRequired(false),
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

		const targetUser = interaction.options.getUser("user", true);
		const durationS = interaction.options.getInteger("duration", true);
		const reason = interaction.options.getString("reason") ?? "No reason provided.";
		const executor = interaction.member;
		const me = interaction.guild.members.me!;

		if (durationS > MAX_TIMEOUT_S) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Invalid duration")} — Maximum timeout is ${bold("28 days")}.`),
			});
			return;
		}

		const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

		if (!target) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Member not found")} — ${userMention(targetUser.id)} (${inlineCode(targetUser.id)}) is not in this server.`,
				),
			});
			return;
		}

		if (target.communicationDisabledUntilTimestamp && target.communicationDisabledUntilTimestamp > Date.now()) {
			const until = new Date(target.communicationDisabledUntilTimestamp);
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Already muted")} — ${userMention(target.id)} is already in timeout until ${time(until, TimestampStyles.FullDateShortTime)}.`,
				),
			});
			return;
		}

		const blockReason = getMuteBlockReason(executor, target, me);

		if (blockReason) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Action blocked")} — ${blockReason}`),
			});
			return;
		}

		const message = await interaction.editReply({
			embeds: [buildPreviewEmbed(target, durationS, reason, executor)],
			components: [buildConfirmRow()],
		});

		const collector = message.createMessageComponentCollector({
			filter: (btn) => btn.user.id === interaction.user.id,
			max: 1,
			time: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();

			if (btn.customId === MUTE_CANCEL_ID) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("🚫 Cancelled")
							.setDescription("The mute was cancelled. No action was taken.")
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
				await target.timeout(durationS * 1_000, `[Zen] Muted by ${executor.user.tag}: ${reason}`);
			} catch (err) {
				log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to mute member");
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("❌ Mute Failed")
							.setDescription("An unexpected error occurred while muting the member.")
							.setColor(Colors.Red)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
					components: [],
				});
				return;
			}

			log.info(
				{ targetId: target.id, executorId: executor.id, durationS, reason },
				`${executor.user.tag} muted ${target.user.tag} for ${formatDuration(durationS)}`,
			);

			await interaction.editReply({
				embeds: [buildResultEmbed(target, durationS, reason, executor, startedAt)],
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
