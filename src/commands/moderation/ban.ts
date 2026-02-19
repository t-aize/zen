import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	blockQuote,
	bold,
	type ChatInputCommandInteraction,
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

const BAN_CONFIRM_ID = "ban:confirm";
const BAN_CANCEL_ID = "ban:cancel";

const log = createLogger("ban");

const getBanBlockReason = (executor: GuildMember, target: GuildMember, me: GuildMember): string | null => {
	if (!target.bannable) return "I don't have permission to ban this member.";
	if (target.id === executor.id) return "You cannot ban yourself.";
	if (target.id === me.id) return "I cannot ban myself.";
	if (target.roles.highest.position >= executor.roles.highest.position)
		return "You cannot ban a member with an equal or higher role than yours.";
	return null;
};

const buildPreviewEmbed = (target: GuildMember, reason: string, deleteMessageDays: number, executor: GuildMember) =>
	new EmbedBuilder()
		.setTitle("🔨 Member Ban")
		.setDescription(
			`You are about to permanently ban ${userMention(target.id)} from the server.\n⚠️ ${bold("This will revoke all their invites and prevent them from rejoining.")}`,
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
				name: "🗑️ Message Purge",
				value: blockQuote(
					deleteMessageDays > 0
						? bold(
								`Last ${deleteMessageDays} day${deleteMessageDays !== 1 ? "s" : ""} of messages will be deleted.`,
							)
						: bold("No messages will be deleted."),
				),
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
		.setTitle("✅ Member Banned")
		.setDescription(`${userMention(target.id)} has been permanently banned from the server.`)
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
			.setCustomId(BAN_CONFIRM_ID)
			.setLabel("Confirm Ban")
			.setEmoji("🔨")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(BAN_CANCEL_ID)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

defineCommand({
	data: new SlashCommandBuilder()
		.setName("ban")
		.setDescription("Permanently ban a member from the server.")
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setNSFW(false)
		.addUserOption((opt) => opt.setName("user").setDescription("The member to ban.").setRequired(true))
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the ban (shown in audit log).")
				.setMaxLength(512)
				.setRequired(false),
		)
		.addIntegerOption((opt) =>
			opt
				.setName("delete_messages")
				.setDescription("Delete messages from the last N days (0–7). Defaults to 0.")
				.setMinValue(0)
				.setMaxValue(7)
				.setRequired(false),
		),

	execute: async (interaction: ChatInputCommandInteraction) => {
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
		const deleteMessageDays = interaction.options.getInteger("delete_messages") ?? 0;
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

		const blockReason = getBanBlockReason(executor, target, me);

		if (blockReason) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Action blocked")} — ${blockReason}`),
			});
			return;
		}

		const message = await interaction.editReply({
			embeds: [buildPreviewEmbed(target, reason, deleteMessageDays, executor)],
			components: [buildConfirmRow()],
		});

		const collector = message.createMessageComponentCollector({
			filter: (btn) => btn.user.id === interaction.user.id,
			max: 1,
			time: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();

			if (btn.customId === BAN_CANCEL_ID) {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("🚫 Cancelled")
							.setDescription("The ban was cancelled. No action was taken.")
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
				await target.ban({
					deleteMessageSeconds: deleteMessageDays * 86_400,
					reason: `[Zen] Banned by ${executor.user.tag}: ${reason}`,
				});
			} catch (err) {
				log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to ban member");
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("❌ Ban Failed")
							.setDescription("An unexpected error occurred while banning the member.")
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
				`${executor.user.tag} banned ${target.user.tag}`,
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
