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

const KICK_CONFIRM_ID = "kick:confirm";
const KICK_CANCEL_ID = "kick:cancel";

const log = createLogger("kick");

/**
 * Returns a human-readable reason why the target cannot be kicked, or `null`
 * if the action is safe to proceed.
 */
const getKickBlockReason = (executor: GuildMember, target: GuildMember, me: GuildMember): string | null => {
	if (!target.kickable) return "I don't have permission to kick this member.";
	if (target.id === executor.id) return "You cannot kick yourself.";
	if (target.id === me.id) return "I cannot kick myself.";
	if (target.roles.highest.position >= executor.roles.highest.position)
		return "You cannot kick a member with an equal or higher role than yours.";
	return null;
};

const buildPreviewEmbed = (target: GuildMember, reason: string, executor: GuildMember) =>
	new EmbedBuilder()
		.setTitle("👢 Member Kick")
		.setDescription(
			`You are about to kick ${userMention(target.id)} from the server.\n⚠️ ${bold("The member will be able to rejoin with a new invite.")}`,
		)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Yellow)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(target.user.tag)}`,
						`${inlineCode("ID:")}   ${inlineCode(target.id)}`,
						`${inlineCode("Roles:")} ${bold(String(target.roles.cache.size - 1))}`,
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

const buildResultEmbed = (target: GuildMember, reason: string, executor: GuildMember, startedAt: Date) =>
	new EmbedBuilder()
		.setTitle("✅ Member Kicked")
		.setDescription(`${userMention(target.id)} has been successfully kicked from the server.`)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Green)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(target.user.tag)}`,
						`${inlineCode("ID:")}   ${inlineCode(target.id)}`,
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

const buildConfirmRow = (disabled = false) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(KICK_CONFIRM_ID)
			.setLabel("Confirm Kick")
			.setEmoji("👢")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(KICK_CANCEL_ID)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

defineCommand({
	data: new SlashCommandBuilder()
		.setName("kick")
		.setDescription("Kick a member from the server.")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setNSFW(false)
		.addUserOption((opt) => opt.setName("user").setDescription("The member to kick.").setRequired(true))
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the kick (shown in audit log).")
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
		const reason = interaction.options.getString("reason") ?? "No reason provided.";
		const executor = interaction.member;
		const me = interaction.guild.members.me!;

		const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

		if (!target) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("Member not found")} — ${userMention(targetUser.id)} (${inlineCode(targetUser.id)}) is not in this server.`,
				),
			});
			return;
		}

		const blockReason = getKickBlockReason(executor, target, me);

		if (blockReason) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Action blocked")} — ${blockReason}`),
			});
			return;
		}

		const message = await interaction.editReply({
			embeds: [buildPreviewEmbed(target, reason, executor)],
			components: [buildConfirmRow()],
		});

		const collector = message.createMessageComponentCollector({
			filter: (btn) => btn.user.id === interaction.user.id,
			max: 1,
			time: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();

			if (btn.customId === KICK_CANCEL_ID) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("🚫 Cancelled")
							.setDescription("The kick was cancelled. No action was taken.")
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
				await target.kick(`[Zen] Kicked by ${executor.user.tag}: ${reason}`);
			} catch (err) {
				log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to kick member");
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("❌ Kick Failed")
							.setDescription("An unexpected error occurred while kicking the member.")
							.setColor(Colors.Red)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
					components: [],
				});
				return;
			}

			log.info(
				{ targetId: target.id, executorId: executor.id, reason },
				`${executor.user.tag} kicked ${target.user.tag}`,
			);

			await interaction.editReply({
				embeds: [buildResultEmbed(target, reason, executor, startedAt)],
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
