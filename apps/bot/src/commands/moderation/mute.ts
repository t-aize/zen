import {
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	type GuildMember,
	inlineCode,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands";
import { createLogger } from "@/utils/logger";
import {
	buildConfirmRow,
	buildErrorEmbed,
	createConfirmationCollector,
	ensureGuild,
	executorField,
	executorFieldWithDuration,
	getBlockReason,
	reasonField,
	replyActionBlocked,
	replyMemberNotFound,
	requestedAtField,
} from "@/utils/moderation";

const CONFIRM_ID = "mute:confirm";
const CANCEL_ID = "mute:cancel";

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

const buildPreviewEmbed = (
	target: GuildMember,
	durationS: number,
	reason: string,
	executor: GuildMember,
) => {
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
			executorField(executor),
			reasonField(reason),
			requestedAtField(),
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
			executorFieldWithDuration(executor.user, startedAt),
			reasonField(reason),
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();
};

defineCommand({
	data: new SlashCommandBuilder()
		.setName("mute")
		.setDescription(
			"Timeout a member using Discord's native exclusion feature.",
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setNSFW(false)
		.addUserOption((opt) =>
			opt
				.setName("user")
				.setDescription("The member to mute.")
				.setRequired(true),
		)
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
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const targetUser = interaction.options.getUser("user", true);
		const durationS = interaction.options.getInteger("duration", true);
		const reason =
			interaction.options.getString("reason") ?? "No reason provided.";
		const executor = interaction.member;
		const me = interaction.guild.members.me!;

		if (durationS > MAX_TIMEOUT_S) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Invalid duration")} — Maximum timeout is ${bold("28 days")}.`,
				),
			});
			return;
		}

		const target = await interaction.guild.members
			.fetch(targetUser.id)
			.catch(() => null);

		if (!target) {
			await replyMemberNotFound(interaction, targetUser.id);
			return;
		}

		if (
			target.communicationDisabledUntilTimestamp &&
			target.communicationDisabledUntilTimestamp > Date.now()
		) {
			const until = new Date(target.communicationDisabledUntilTimestamp);
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Already muted")} — ${userMention(target.id)} is already in timeout until ${time(until, TimestampStyles.FullDateShortTime)}.`,
				),
			});
			return;
		}

		const blockReason = getBlockReason(executor, target, me, {
			permissionCheck: target.moderatable,
			noPermissionMessage: "I don't have permission to timeout this member.",
			action: "mute",
		});

		if (blockReason) {
			await replyActionBlocked(interaction, blockReason);
			return;
		}

		await interaction.editReply({
			embeds: [buildPreviewEmbed(target, durationS, reason, executor)],
			components: [
				buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Mute", "🔇"),
			],
		});

		createConfirmationCollector({
			interaction,
			confirmId: CONFIRM_ID,
			cancelId: CANCEL_ID,
			cancelledAction: "mute",
			timedOutMessage: "No action was taken.",
			buildConfirmRowDisabled: () =>
				buildConfirmRow(
					CONFIRM_ID,
					CANCEL_ID,
					"Confirm Mute",
					"🔇",
					undefined,
					true,
				),
			onConfirm: async () => {
				const startedAt = new Date();

				try {
					await target.timeout(
						durationS * 1_000,
						`[Zen] Muted by ${executor.user.tag}: ${reason}`,
					);
				} catch (err) {
					log.error(
						{ err, targetId: target.id, executorId: executor.id },
						"Failed to mute member",
					);
					await interaction.editReply({
						embeds: [
							buildErrorEmbed(
								"Mute Failed",
								"An unexpected error occurred while muting the member.",
							),
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
					embeds: [
						buildResultEmbed(target, durationS, reason, executor, startedAt),
					],
					components: [],
				});
			},
		});
	},
});
