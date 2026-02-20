import {
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
	createConfirmationCollector,
	ensureGuild,
	executorFieldWithDuration,
	reasonField,
	requestedAtField,
} from "@/utils/moderation.js";

const CONFIRM_ID = "massban:confirm";
const CANCEL_ID = "massban:cancel";

const log = createLogger("massban");

/** Parse a space/comma/newline separated list of snowflake IDs. */
const parseIds = (input: string): string[] => [...new Set(input.match(/\d{17,20}/g) ?? [])];

defineCommand({
	data: new SlashCommandBuilder()
		.setName("massban")
		.setDescription("Ban multiple users at once by their IDs.")
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setNSFW(false)
		.addStringOption((opt) =>
			opt
				.setName("users")
				.setDescription("User IDs to ban (space, comma, or newline separated).")
				.setRequired(true),
		)
		.addStringOption((opt) =>
			opt
				.setName("reason")
				.setDescription("Reason for the mass ban (shown in audit log).")
				.setMaxLength(512)
				.setRequired(false),
		)
		.addIntegerOption((opt) =>
			opt
				.setName("delete_messages")
				.setDescription("Delete messages from the last N days (0–7). Defaults to 1.")
				.setMinValue(0)
				.setMaxValue(7)
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const rawInput = interaction.options.getString("users", true);
		const reason = interaction.options.getString("reason") ?? "No reason provided.";
		const deleteMessageDays = interaction.options.getInteger("delete_messages") ?? 1;
		const ids = parseIds(rawInput);

		if (ids.length === 0) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("No valid IDs")} — Could not find any valid user IDs in your input.`),
			});
			return;
		}

		if (ids.length > 200) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("Too many IDs")} — Maximum is ${bold("200")} users per mass ban.`),
			});
			return;
		}

		const selfId = interaction.guild.members.me!.id;
		const filtered = ids.filter((id) => id !== interaction.user.id && id !== selfId);

		if (filtered.length === 0) {
			await interaction.editReply({
				content: blockQuote(`⛔ ${bold("No valid targets")} — You cannot ban yourself or the bot.`),
			});
			return;
		}

		await interaction.editReply({
			embeds: [
				new EmbedBuilder()
					.setTitle("⚠️ Mass Ban")
					.setDescription(
						`You are about to ban ${bold(String(filtered.length))} user${filtered.length !== 1 ? "s" : ""} from the server.\n⚠️ ${bold("This action cannot be undone easily.")}`,
					)
					.setColor(Colors.Yellow)
					.addFields(
						{
							name: "🎯 Targets",
							value: blockQuote(
								filtered.length <= 10
									? filtered.map((id) => `${userMention(id)} (${inlineCode(id)})`).join("\n")
									: [
											...filtered
												.slice(0, 10)
												.map((id) => `${userMention(id)} (${inlineCode(id)})`),
											`…and ${bold(String(filtered.length - 10))} more`,
										].join("\n"),
							),
							inline: false,
						},
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
					.setTimestamp(),
			],
			components: [buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Mass Ban", "⚠️")],
		});

		createConfirmationCollector({
			interaction,
			confirmId: CONFIRM_ID,
			cancelId: CANCEL_ID,
			cancelledAction: "mass ban",
			timedOutMessage: "No action was taken.",
			buildConfirmRowDisabled: () =>
				buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Mass Ban", "⚠️", undefined, true),
			onConfirm: async () => {
				const startedAt = new Date();
				let banned = 0;
				let failed = 0;
				const errors: string[] = [];

				for (const id of filtered) {
					try {
						await interaction.guild.members.ban(id, {
							deleteMessageSeconds: deleteMessageDays * 86_400,
							reason: `[Zen] Mass ban by ${interaction.user.tag}: ${reason}`,
						});
						banned++;
					} catch {
						failed++;
						if (errors.length < 5) errors.push(id);
					}
				}

				log.info(
					{
						executorId: interaction.user.id,
						totalTargets: filtered.length,
						banned,
						failed,
						reason,
					},
					`${interaction.user.tag} mass banned ${banned}/${filtered.length} users`,
				);

				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle(failed === 0 ? "✅ Mass Ban Complete" : "⚠️ Mass Ban Partial")
							.setDescription(
								failed === 0
									? `Successfully banned ${bold(String(banned))} user${banned !== 1 ? "s" : ""}.`
									: `Banned ${bold(String(banned))} user${banned !== 1 ? "s" : ""}, ${bold(String(failed))} failed.`,
							)
							.setColor(failed === 0 ? Colors.Green : Colors.Orange)
							.addFields(
								{
									name: "📊 Summary",
									value: blockQuote(
										[
											`${inlineCode("Banned:")}  ${bold(String(banned))}`,
											`${inlineCode("Failed:")}  ${bold(String(failed))}`,
											`${inlineCode("Total:")}   ${bold(String(filtered.length))}`,
										].join("\n"),
									),
									inline: true,
								},
								executorFieldWithDuration(interaction.user, startedAt),
								reasonField(reason),
								...(errors.length > 0
									? [
											{
												name: "❌ Failed IDs",
												value: blockQuote(
													errors.map((id) => inlineCode(id)).join(", ") +
														(failed > 5 ? ` …+${failed - 5} more` : ""),
												),
												inline: false,
											},
										]
									: []),
							)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
					components: [],
				});
			},
		});
	},
});
