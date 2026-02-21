import {
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
	PermissionFlagsBits,
	SlashCommandBuilder,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands";
import { createLogger } from "@/utils/logger";
import {
	ensureGuild,
	executorFieldWithDuration,
	getBlockReason,
	reasonField,
	replyActionBlocked,
	replyMemberNotFound,
	targetField,
} from "@/utils/moderation";

const log = createLogger("unmute");

const buildResultEmbed = (
	target: import("discord.js").GuildMember,
	reason: string,
	executor: import("discord.js").GuildMember,
	startedAt: Date,
) =>
	new EmbedBuilder()
		.setTitle("✅ Member Unmuted")
		.setDescription(`${userMention(target.id)} has been removed from timeout.`)
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
		.setName("unmute")
		.setDescription("Remove the active timeout of a member.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setNSFW(false)
		.addUserOption((opt) =>
			opt
				.setName("user")
				.setDescription("The member to unmute.")
				.setRequired(true),
		)
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the unmute (shown in audit log).")
				.setMaxLength(512)
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const targetUser = interaction.options.getUser("user", true);
		const reason =
			interaction.options.getString("reason") ?? "No reason provided.";
		const executor = interaction.member;
		const me = interaction.guild.members.me!;

		const target = await interaction.guild.members
			.fetch(targetUser.id)
			.catch(() => null);

		if (!target) {
			await replyMemberNotFound(interaction, targetUser.id);
			return;
		}

		const isTimedOut =
			target.communicationDisabledUntilTimestamp !== null &&
			target.communicationDisabledUntilTimestamp > Date.now();

		if (!isTimedOut) {
			await interaction.editReply({
				content: blockQuote(
					`ℹ️ ${bold("Not muted")} — ${userMention(target.id)} is not currently in timeout.`,
				),
			});
			return;
		}

		const blockReason = getBlockReason(executor, target, me, {
			permissionCheck: target.moderatable,
			noPermissionMessage:
				"I don't have permission to manage this member's timeout.",
			action: "unmute",
		});

		if (blockReason) {
			await replyActionBlocked(interaction, blockReason);
			return;
		}

		const startedAt = new Date();

		try {
			await target.timeout(
				null,
				`[Zen] Unmuted by ${executor.user.tag}: ${reason}`,
			);
		} catch (err) {
			log.error(
				{ err, targetId: target.id, executorId: executor.id },
				"Failed to unmute member",
			);
			await interaction.editReply({
				content: blockQuote(
					`❌ ${bold("Failed")} — An unexpected error occurred while removing the timeout.`,
				),
			});
			return;
		}

		log.info(
			{ targetId: target.id, executorId: executor.id, reason },
			`${executor.user.tag} unmuted ${target.user.tag}`,
		);

		await interaction.editReply({
			embeds: [buildResultEmbed(target, reason, executor, startedAt)],
		});
	},
});
