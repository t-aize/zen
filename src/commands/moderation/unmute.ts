import {
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
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("unmute");

const getUnmuteBlockReason = (executor: GuildMember, target: GuildMember, me: GuildMember): string | null => {
	if (!target.moderatable) return "I don't have permission to manage this member's timeout.";
	if (target.id === executor.id) return "You cannot unmute yourself.";
	if (target.id === me.id) return "I cannot unmute myself.";
	if (target.roles.highest.position >= executor.roles.highest.position)
		return "You cannot unmute a member with an equal or higher role than yours.";
	return null;
};

const buildResultEmbed = (target: GuildMember, reason: string, executor: GuildMember, startedAt: Date) =>
	new EmbedBuilder()
		.setTitle("✅ Member Unmuted")
		.setDescription(`${userMention(target.id)} has been removed from timeout.`)
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

defineCommand({
	data: new SlashCommandBuilder()
		.setName("unmute")
		.setDescription("Remove the active timeout of a member.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setNSFW(false)
		.addUserOption((opt) => opt.setName("user").setDescription("The member to unmute.").setRequired(true))
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the unmute (shown in audit log).")
				.setMaxLength(512)
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

		const isTimedOut =
			target.communicationDisabledUntilTimestamp !== null &&
			target.communicationDisabledUntilTimestamp > Date.now();

		if (!isTimedOut) {
			await interaction.editReply({
				content: blockQuote(`ℹ️ ${bold("Not muted")} — ${userMention(target.id)} is not currently in timeout.`),
			});
			return;
		}

		const blockReason = getUnmuteBlockReason(executor, target, me);

		if (blockReason) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Action blocked")} — ${blockReason}`),
			});
			return;
		}

		const startedAt = new Date();

		try {
			await target.timeout(null, `[Zen] Unmuted by ${executor.user.tag}: ${reason}`);
		} catch (err) {
			log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to unmute member");
			await interaction.editReply({
				content: blockQuote(`❌ ${bold("Failed")} — An unexpected error occurred while removing the timeout.`),
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
