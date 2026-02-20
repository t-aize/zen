import {
	ButtonStyle,
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
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
	executorFieldWithDuration,
	reasonField,
	requestedAtField,
	targetFieldRaw,
} from "@/utils/moderation.js";

const CONFIRM_ID = "unban:confirm";
const CANCEL_ID = "unban:cancel";

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
			targetFieldRaw(targetTag, targetId),
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
			reasonField(reason),
			requestedAtField(),
		)
		.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
		.setTimestamp();

const buildResultEmbed = (targetTag: string, targetId: string, reason: string, executorTag: string, startedAt: Date) =>
	new EmbedBuilder()
		.setTitle("✅ Member Unbanned")
		.setDescription(`${userMention(targetId)} has been successfully unbanned from the server.`)
		.setColor(Colors.Green)
		.addFields(
			targetFieldRaw(targetTag, targetId),
			executorFieldWithDuration({ tag: executorTag }, startedAt),
			reasonField(reason),
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

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
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

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

		await interaction.editReply({
			embeds: [buildPreviewEmbed(targetTag, targetId, reason, executor.user.tag, executor.id)],
			components: [buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Unban", "🔓", ButtonStyle.Success)],
		});

		createConfirmationCollector({
			interaction,
			confirmId: CONFIRM_ID,
			cancelId: CANCEL_ID,
			cancelledAction: "unban",
			timedOutMessage: "No action was taken.",
			buildConfirmRowDisabled: () =>
				buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Unban", "🔓", ButtonStyle.Success, true),
			onConfirm: async () => {
				const startedAt = new Date();

				try {
					await interaction.guild.members.unban(
						targetId,
						`[Zen] Unbanned by ${executor.user.tag}: ${reason}`,
					);
				} catch (err) {
					log.error({ err, targetId, executorId: executor.id }, "Failed to unban user");
					await interaction.editReply({
						embeds: [
							buildErrorEmbed("Unban Failed", "An unexpected error occurred while unbanning the user."),
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
			},
		});
	},
});
