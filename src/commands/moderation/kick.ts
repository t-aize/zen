import {
	bold,
	Colors,
	EmbedBuilder,
	type GuildMember,
	inlineCode,
	PermissionFlagsBits,
	SlashCommandBuilder,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";
import { createLogger } from "@/utils/logger.js";
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
} from "@/utils/moderation.js";

const CONFIRM_ID = "kick:confirm";
const CANCEL_ID = "kick:cancel";

const log = createLogger("kick");

const buildPreviewEmbed = (target: GuildMember, reason: string, executor: GuildMember) =>
	new EmbedBuilder()
		.setTitle("👢 Member Kick")
		.setDescription(
			`You are about to kick ${userMention(target.id)} from the server.\n⚠️ ${bold("The member will be able to rejoin with a new invite.")}`,
		)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Yellow)
		.addFields(
			targetField(target, [`${inlineCode("Roles:")} ${bold(String(target.roles.cache.size - 1))}`]),
			executorField(executor),
			reasonField(reason),
			requestedAtField(),
		)
		.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
		.setTimestamp();

const buildResultEmbed = (target: GuildMember, reason: string, executor: GuildMember, startedAt: Date) =>
	new EmbedBuilder()
		.setTitle("✅ Member Kicked")
		.setDescription(`${userMention(target.id)} has been successfully kicked from the server.`)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Green)
		.addFields(targetField(target), executorFieldWithDuration(executor.user, startedAt), reasonField(reason))
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

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
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const targetUser = interaction.options.getUser("user", true);
		const reason = interaction.options.getString("reason") ?? "No reason provided.";
		const executor = interaction.member;
		const me = interaction.guild.members.me!;

		const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

		if (!target) {
			await replyMemberNotFound(interaction, targetUser.id);
			return;
		}

		const blockReason = getBlockReason(executor, target, me, {
			permissionCheck: target.kickable,
			noPermissionMessage: "I don't have permission to kick this member.",
			action: "kick",
		});

		if (blockReason) {
			await replyActionBlocked(interaction, blockReason);
			return;
		}

		await interaction.editReply({
			embeds: [buildPreviewEmbed(target, reason, executor)],
			components: [buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Kick", "👢")],
		});

		createConfirmationCollector({
			interaction,
			confirmId: CONFIRM_ID,
			cancelId: CANCEL_ID,
			cancelledAction: "kick",
			timedOutMessage: "No action was taken.",
			buildConfirmRowDisabled: () =>
				buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Kick", "👢", undefined, true),
			onConfirm: async () => {
				const startedAt = new Date();

				try {
					await target.kick(`[Zen] Kicked by ${executor.user.tag}: ${reason}`);
				} catch (err) {
					log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to kick member");
					await interaction.editReply({
						embeds: [
							buildErrorEmbed("Kick Failed", "An unexpected error occurred while kicking the member."),
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
			},
		});
	},
});
