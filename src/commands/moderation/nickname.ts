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
	TimestampStyles,
	time,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("nickname");

const getNicknameBlockReason = (executor: GuildMember, target: GuildMember, me: GuildMember): string | null => {
	if (!target.manageable) return "I don't have permission to manage this member.";
	if (target.id === me.id) return "I cannot change my own nickname with this command.";
	if (target.id !== executor.id && target.roles.highest.position >= executor.roles.highest.position)
		return "You cannot manage a member with an equal or higher role than yours.";
	return null;
};

const buildResultEmbed = (
	target: GuildMember,
	oldNick: string | null,
	newNick: string | null,
	executor: GuildMember,
	startedAt: Date,
) =>
	new EmbedBuilder()
		.setTitle(newNick ? "✏️ Nickname Changed" : "✏️ Nickname Reset")
		.setDescription(
			newNick
				? `The nickname of ${userMention(target.id)} has been updated.`
				: `The nickname of ${userMention(target.id)} has been reset to their username.`,
		)
		.setThumbnail(target.displayAvatarURL())
		.setColor(Colors.Blue)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")}    ${bold(target.user.tag)}`,
						`${inlineCode("ID:")}      ${inlineCode(target.id)}`,
						`${inlineCode("Before:")}  ${bold(oldNick ?? target.user.username)}`,
						`${inlineCode("After:")}   ${bold(newNick ?? target.user.username)}`,
					].join("\n"),
				),
				inline: false,
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
				name: "🕐 Changed At",
				value: blockQuote(
					`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
				),
				inline: true,
			},
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

defineCommand({
	data: new SlashCommandBuilder()
		.setName("nickname")
		.setDescription("Change or reset a member's nickname.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
		.setNSFW(false)
		.addUserOption((opt) => opt.setName("user").setDescription("The member to rename.").setRequired(true))
		.addStringOption((opt) =>
			opt
				.setName("nickname")
				.setDescription("The new nickname. Leave empty to reset to their username.")
				.setMinLength(1)
				.setMaxLength(32)
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
		const newNick = interaction.options.getString("nickname") ?? null;
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

		const blockReason = getNicknameBlockReason(executor, target, me);

		if (blockReason) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Action blocked")} — ${blockReason}`),
			});
			return;
		}

		const oldNick = target.nickname;

		if (oldNick === newNick) {
			await interaction.editReply({
				content: blockQuote(
					`ℹ️ ${bold("No change")} — ${userMention(target.id)} already has ${newNick ? `the nickname ${bold(newNick)}` : "no nickname"}.`,
				),
			});
			return;
		}

		const startedAt = new Date();

		try {
			await target.setNickname(newNick, `[Zen] Changed by ${executor.user.tag}`);
		} catch (err) {
			log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to change nickname");
			await interaction.editReply({
				content: blockQuote(`❌ ${bold("Failed")} — An unexpected error occurred while changing the nickname.`),
			});
			return;
		}

		log.info(
			{ targetId: target.id, executorId: executor.id, oldNick, newNick },
			`${executor.user.tag} changed nickname of ${target.user.tag}: "${oldNick}" → "${newNick}"`,
		);

		await interaction.editReply({
			embeds: [buildResultEmbed(target, oldNick, newNick, executor, startedAt)],
		});
	},
});
