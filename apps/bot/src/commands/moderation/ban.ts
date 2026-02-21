import {
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	type GuildMember,
	inlineCode,
	PermissionFlagsBits,
	SlashCommandBuilder,
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
	targetField,
} from "@/utils/moderation";

const CONFIRM_ID = "ban:confirm";
const CANCEL_ID = "ban:cancel";

const log = createLogger("ban");

const buildPreviewEmbed = (
	target: GuildMember,
	reason: string,
	deleteMessageDays: number,
	executor: GuildMember,
) =>
	new EmbedBuilder()
		.setTitle("🔨 Member Ban")
		.setDescription(
			`You are about to permanently ban ${userMention(target.id)} from the server.\n⚠️ ${bold("This will revoke all their invites and prevent them from rejoining.")}`,
		)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Yellow)
		.addFields(
			targetField(target, [
				`${inlineCode("Roles:")} ${bold(String(target.roles.cache.size - 1))}`,
			]),
			executorField(executor),
			reasonField(reason),
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
			requestedAtField(),
		)
		.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
		.setTimestamp();

const buildResultEmbed = (
	target: GuildMember,
	reason: string,
	executor: GuildMember,
	startedAt: Date,
) =>
	new EmbedBuilder()
		.setTitle("✅ Member Banned")
		.setDescription(
			`${userMention(target.id)} has been permanently banned from the server.`,
		)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Green)
		.addFields(
			targetField(target),
			executorFieldWithDuration(executor.user, startedAt),
			reasonField(reason),
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

defineCommand({
	data: new SlashCommandBuilder()
		.setName("ban")
		.setDescription("Permanently ban a member from the server.")
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setNSFW(false)
		.addUserOption((opt) =>
			opt
				.setName("user")
				.setDescription("The member to ban.")
				.setRequired(true),
		)
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
				.setDescription(
					"Delete messages from the last N days (0–7). Defaults to 0.",
				)
				.setMinValue(0)
				.setMaxValue(7)
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const targetUser = interaction.options.getUser("user", true);
		const reason =
			interaction.options.getString("reason") ?? "No reason provided.";
		const deleteMessageDays =
			interaction.options.getInteger("delete_messages") ?? 0;
		const executor = interaction.member;
		const me = interaction.guild.members.me!;

		const target = await interaction.guild.members
			.fetch(targetUser.id)
			.catch(() => null);

		if (!target) {
			await replyMemberNotFound(interaction, targetUser.id);
			return;
		}

		const blockReason = getBlockReason(executor, target, me, {
			permissionCheck: target.bannable,
			noPermissionMessage: "I don't have permission to ban this member.",
			action: "ban",
		});

		if (blockReason) {
			await replyActionBlocked(interaction, blockReason);
			return;
		}

		await interaction.editReply({
			embeds: [buildPreviewEmbed(target, reason, deleteMessageDays, executor)],
			components: [buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Ban", "🔨")],
		});

		createConfirmationCollector({
			interaction,
			confirmId: CONFIRM_ID,
			cancelId: CANCEL_ID,
			cancelledAction: "ban",
			timedOutMessage: "No action was taken.",
			buildConfirmRowDisabled: () =>
				buildConfirmRow(
					CONFIRM_ID,
					CANCEL_ID,
					"Confirm Ban",
					"🔨",
					undefined,
					true,
				),
			onConfirm: async () => {
				const startedAt = new Date();

				try {
					await target.ban({
						deleteMessageSeconds: deleteMessageDays * 86_400,
						reason: `[Zen] Banned by ${executor.user.tag}: ${reason}`,
					});
				} catch (err) {
					log.error(
						{ err, targetId: target.id, executorId: executor.id },
						"Failed to ban member",
					);
					await interaction.editReply({
						embeds: [
							buildErrorEmbed(
								"Ban Failed",
								"An unexpected error occurred while banning the member.",
							),
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
			},
		});
	},
});
