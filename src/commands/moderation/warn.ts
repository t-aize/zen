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
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@/commands/index.js";
import { db } from "@/db/index.js";
import { warnings } from "@/db/schema/index.js";
import { createLogger } from "@/utils/logger.js";
import {
	buildConfirmRow,
	createConfirmationCollector,
	ensureGuild,
	executorField,
	executorFieldWithDuration,
	reasonField,
	replyActionBlocked,
	replyMemberNotFound,
	requestedAtField,
	targetField,
} from "@/utils/moderation.js";

const WARN_ADD_CONFIRM_ID = "warn:add:confirm";
const WARN_ADD_CANCEL_ID = "warn:add:cancel";
const WARN_REMOVE_CONFIRM_ID = "warn:remove:confirm";
const WARN_REMOVE_CANCEL_ID = "warn:remove:cancel";
const WARN_CLEAR_CONFIRM_ID = "warn:clear:confirm";
const WARN_CLEAR_CANCEL_ID = "warn:clear:cancel";

const WARNINGS_PER_PAGE = 5;

const log = createLogger("warn");

const getWarnBlockReason = (executor: GuildMember, target: GuildMember, me: GuildMember): string | null => {
	if (target.id === me.id) return "I cannot warn myself.";
	if (target.id === executor.id) return "You cannot warn yourself.";
	if (target.user.bot) return "You cannot warn a bot.";
	if (target.roles.highest.position >= executor.roles.highest.position)
		return "You cannot warn a member with an equal or higher role than yours.";
	return null;
};

defineCommand({
	data: new SlashCommandBuilder()
		.setName("warn")
		.setDescription("Manage warnings for a member.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setNSFW(false)
		.addSubcommand((sub) =>
			sub
				.setName("add")
				.setDescription("Issue a warning to a member.")
				.addUserOption((opt) => opt.setName("user").setDescription("The member to warn.").setRequired(true))
				.addStringOption((opt) =>
					opt.setName("reason").setDescription("Reason for the warning.").setMaxLength(512).setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("list")
				.setDescription("List all warnings for a member.")
				.addUserOption((opt) => opt.setName("user").setDescription("The member to look up.").setRequired(true))
				.addIntegerOption((opt) =>
					opt.setName("page").setDescription("Page number.").setMinValue(1).setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("remove")
				.setDescription("Remove a specific warning by its ID.")
				.addStringOption((opt) =>
					opt.setName("id").setDescription("The warning ID to remove.").setMinLength(1).setRequired(true),
				)
				.addStringOption((opt) =>
					opt
						.setName("reason")
						.setDescription("Reason for the removal.")
						.setMaxLength(512)
						.setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("clear")
				.setDescription("Clear all warnings for a member.")
				.addUserOption((opt) =>
					opt.setName("user").setDescription("The member to clear warnings for.").setRequired(true),
				)
				.addStringOption((opt) =>
					opt
						.setName("reason")
						.setDescription("Reason for clearing all warnings.")
						.setMaxLength(512)
						.setRequired(false),
				),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		const sub = interaction.options.getSubcommand(true) as "add" | "list" | "remove" | "clear";

		if (sub === "add") {
			await interaction.deferReply({ flags: 64 });

			const targetUser = interaction.options.getUser("user", true);
			const reason = interaction.options.getString("reason", true);
			const executor = interaction.member;
			const me = interaction.guild.members.me!;

			const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

			if (!target) {
				await replyMemberNotFound(interaction, targetUser.id);
				return;
			}

			const blockReason = getWarnBlockReason(executor, target, me);

			if (blockReason) {
				await replyActionBlocked(interaction, blockReason);
				return;
			}

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("⚠️ Issue Warning")
						.setDescription(
							`You are about to warn ${userMention(target.id)}.\n${bold("The member will receive a DM notification if their DMs are open.")}`,
						)
						.setThumbnail(target.displayAvatarURL())
						.setColor(Colors.Yellow)
						.addFields(
							targetField(target),
							executorField(executor),
							reasonField(reason),
							requestedAtField(),
						)
						.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
						.setTimestamp(),
				],
				components: [buildConfirmRow(WARN_ADD_CONFIRM_ID, WARN_ADD_CANCEL_ID, "Confirm Warn", "⚠️")],
			});

			createConfirmationCollector({
				interaction,
				confirmId: WARN_ADD_CONFIRM_ID,
				cancelId: WARN_ADD_CANCEL_ID,
				cancelledAction: "warning",
				timedOutMessage: "The warning was not performed.",
				buildConfirmRowDisabled: () =>
					buildConfirmRow(WARN_ADD_CONFIRM_ID, WARN_ADD_CANCEL_ID, "Confirm Warn", "⚠️", undefined, true),
				onConfirm: async () => {
					const startedAt = new Date();

					let warnId: string;
					let totalWarnings: number;

					try {
						const result = await db
							.insert(warnings)
							.values({
								guildId: interaction.guildId,
								userId: target.id,
								moderatorId: executor.id,
								moderatorTag: executor.user.tag,
								reason,
								createdAt: startedAt,
							})
							.returning({ id: warnings.id });

						const inserted = result[0];

						if (!inserted) {
							log.error({ targetId: target.id, executorId: executor.id }, "Insert returned no rows");
							await interaction.editReply({
								content: blockQuote(
									`❌ ${bold("Failed")} — An unexpected error occurred while saving the warning.`,
								),
								components: [],
							});
							return;
						}

						warnId = inserted.id;

						const all = await db.query.warnings.findMany({
							where: (w, { eq, and }) => and(eq(w.guildId, interaction.guildId), eq(w.userId, target.id)),
						});
						totalWarnings = all.length;
					} catch (err) {
						log.error({ err, targetId: target.id, executorId: executor.id }, "Failed to insert warning");
						await interaction.editReply({
							content: blockQuote(
								`❌ ${bold("Failed")} — An unexpected error occurred while saving the warning.`,
							),
							components: [],
						});
						return;
					}

					log.info(
						{ warnId, targetId: target.id, executorId: executor.id, reason, totalWarnings },
						`${executor.user.tag} warned ${target.user.tag} (warn #${warnId})`,
					);

					try {
						await target.send({
							embeds: [
								new EmbedBuilder()
									.setTitle("⚠️ You have been warned")
									.setDescription(`You received a warning in ${bold(interaction.guild.name)}.`)
									.setColor(Colors.Yellow)
									.addFields(reasonField(reason), {
										name: "🪪 Warning ID",
										value: blockQuote(`${inlineCode("ID:")} ${bold(String(warnId))}`),
										inline: false,
									})
									.setFooter({ text: `${interaction.guild.name} • Moderation` })
									.setTimestamp(),
							],
						});
					} catch {
						log.debug({ targetId: target.id }, "Could not DM warning to member (DMs likely closed)");
					}

					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle("✅ Warning Issued")
								.setDescription(`${userMention(target.id)} has been warned.`)
								.setThumbnail(target.displayAvatarURL())
								.setColor(Colors.Green)
								.addFields(
									targetField(target, [
										`${inlineCode("Warnings:")} ${bold(String(totalWarnings))} total on this server`,
									]),
									executorFieldWithDuration(executor.user, startedAt),
									reasonField(reason),
									{
										name: "🪪 Warning ID",
										value: blockQuote(`${inlineCode("ID:")} ${bold(String(warnId))}`),
										inline: false,
									},
								)
								.setFooter({ text: "Zen • Moderation" })
								.setTimestamp(),
						],
						components: [],
					});
				},
			});

			return;
		}

		if (sub === "list") {
			await interaction.deferReply({ flags: 64 });

			const targetUser = interaction.options.getUser("user", true);
			const page = interaction.options.getInteger("page") ?? 1;

			let all: (typeof warnings.$inferSelect)[];

			try {
				all = await db.query.warnings.findMany({
					where: (w, { eq, and }) => and(eq(w.guildId, interaction.guildId), eq(w.userId, targetUser.id)),
				});
				all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
			} catch (err) {
				log.error({ err, userId: targetUser.id }, "Failed to fetch warnings");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch warnings from the database.`),
				});
				return;
			}

			const totalPages = Math.max(1, Math.ceil(all.length / WARNINGS_PER_PAGE));
			const safePage = Math.min(page, totalPages);
			const pageWarnings = all.slice((safePage - 1) * WARNINGS_PER_PAGE, safePage * WARNINGS_PER_PAGE);

			const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
			const hasWarnings = all.length > 0;

			const embed = new EmbedBuilder()
				.setTitle(`📋 Warning History — ${targetUser.tag}`)
				.setThumbnail(targetMember?.displayAvatarURL() ?? targetUser.displayAvatarURL())
				.setColor(hasWarnings ? Colors.Orange : Colors.Green)
				.setFooter({
					text: `Zen • Moderation${totalPages > 1 ? ` — Page ${safePage}/${totalPages}` : ""}`,
				})
				.setTimestamp();

			if (!hasWarnings) {
				embed.setDescription(`${userMention(targetUser.id)} has a ${bold("clean record")} on this server. ✅`);
			} else {
				embed.setDescription(
					`${userMention(targetUser.id)} has ${bold(`${all.length} warning${all.length !== 1 ? "s" : ""}`)} on ${bold(interaction.guild.name)}.`,
				);

				embed.addFields(
					{
						name: "📊 Overview",
						value: blockQuote(
							[
								`${inlineCode("Total:")}    ${bold(String(all.length))} warning${all.length !== 1 ? "s" : ""}`,
								`${inlineCode("Latest:")}   ${time(all[0]!.createdAt, TimestampStyles.RelativeTime)}`,
								`${inlineCode("Earliest:")} ${time(all.at(-1)!.createdAt, TimestampStyles.ShortDate)}`,
							].join("\n"),
						),
						inline: false,
					},
					...pageWarnings.map((w, i) => {
						const num = (safePage - 1) * WARNINGS_PER_PAGE + i + 1;
						return {
							name: `${bold(`#${num}`)} · ${time(w.createdAt, TimestampStyles.ShortDate)} · ${inlineCode(w.id)}`,
							value: blockQuote(
								[
									`${inlineCode("Reason:")} ${bold(w.reason)}`,
									`${inlineCode("By:")}     ${bold(w.moderatorTag)}`,
									`${inlineCode("When:")}   ${time(w.createdAt, TimestampStyles.RelativeTime)}`,
								].join("\n"),
							),
							inline: false,
						};
					}),
				);
			}

			await interaction.editReply({ embeds: [embed] });

			return;
		}

		if (sub === "remove") {
			await interaction.deferReply({ flags: 64 });

			const warnId = interaction.options.getString("id", true);
			const reason = interaction.options.getString("reason") ?? "No reason provided.";
			const executor = interaction.member;

			let warn: typeof warnings.$inferSelect | undefined;

			try {
				warn = await db.query.warnings.findFirst({
					where: (w, { eq, and }) => and(eq(w.id, warnId), eq(w.guildId, interaction.guildId)),
				});
			} catch (err) {
				log.error({ err, warnId }, "Failed to fetch warning for removal");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch the warning from the database.`),
				});
				return;
			}

			if (!warn) {
				await interaction.editReply({
					content: blockQuote(
						`⛔ ${bold("Not found")} — No warning with ID ${inlineCode(`#${warnId}`)} exists on this server.`,
					),
				});
				return;
			}

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("🗑️ Remove Warning")
						.setDescription(
							`You are about to remove warning ${inlineCode(`#${warnId}`)} from ${userMention(warn.userId)}.`,
						)
						.setColor(Colors.Yellow)
						.addFields(
							{
								name: "🪪 Warning",
								value: blockQuote(
									[
										`${inlineCode("ID:")}     ${bold(String(warnId))}`,
										`${inlineCode("User:")}   ${userMention(warn.userId)}`,
										`${inlineCode("Reason:")} ${bold(warn.reason)}`,
										`${inlineCode("By:")}     ${bold(warn.moderatorTag)}`,
										`${inlineCode("At:")}     ${time(warn.createdAt, TimestampStyles.FullDateShortTime)}`,
									].join("\n"),
								),
								inline: false,
							},
							executorField(executor),
							reasonField(reason, "📝 Removal Reason"),
							requestedAtField(),
						)
						.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
						.setTimestamp(),
				],
				components: [buildConfirmRow(WARN_REMOVE_CONFIRM_ID, WARN_REMOVE_CANCEL_ID, "Confirm Remove", "🗑️")],
			});

			createConfirmationCollector({
				interaction,
				confirmId: WARN_REMOVE_CONFIRM_ID,
				cancelId: WARN_REMOVE_CANCEL_ID,
				cancelledAction: "removal",
				timedOutMessage: "The removal was not performed.",
				buildConfirmRowDisabled: () =>
					buildConfirmRow(
						WARN_REMOVE_CONFIRM_ID,
						WARN_REMOVE_CANCEL_ID,
						"Confirm Remove",
						"🗑️",
						undefined,
						true,
					),
				onConfirm: async () => {
					const startedAt = new Date();

					try {
						await db
							.delete(warnings)
							.where(and(eq(warnings.id, warn!.id), eq(warnings.guildId, interaction.guildId)));
					} catch (err) {
						log.error({ err, warnId }, "Failed to delete warning");
						await interaction.editReply({
							content: blockQuote(
								`❌ ${bold("Failed")} — Could not delete the warning from the database.`,
							),
							components: [],
						});
						return;
					}

					log.info(
						{ warnId, targetId: warn!.userId, executorId: executor.id, reason },
						`${executor.user.tag} removed warning #${warnId} from user ${warn!.userId}`,
					);

					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle("✅ Warning Removed")
								.setDescription(
									`Warning ${inlineCode(`#${warnId}`)} has been removed from ${userMention(warn!.userId)}.`,
								)
								.setColor(Colors.Green)
								.addFields(
									{
										name: "🪪 Warning",
										value: blockQuote(
											[
												`${inlineCode("ID:")}     ${bold(String(warnId))}`,
												`${inlineCode("User:")}   ${userMention(warn!.userId)}`,
												`${inlineCode("Reason:")} ${bold(warn!.reason)}`,
											].join("\n"),
										),
										inline: true,
									},
									executorFieldWithDuration(executor.user, startedAt),
									reasonField(reason, "📝 Removal Reason"),
								)
								.setFooter({ text: "Zen • Moderation" })
								.setTimestamp(),
						],
						components: [],
					});
				},
			});

			return;
		}

		if (sub === "clear") {
			await interaction.deferReply({ flags: 64 });

			const targetUser = interaction.options.getUser("user", true);
			const reason = interaction.options.getString("reason") ?? "No reason provided.";
			const executor = interaction.member;

			let count: number;

			try {
				const existing = await db.query.warnings.findMany({
					where: (w, { eq, and }) => and(eq(w.guildId, interaction.guildId), eq(w.userId, targetUser.id)),
				});
				count = existing.length;
			} catch (err) {
				log.error({ err, targetId: targetUser.id }, "Failed to fetch warnings for clear");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch warnings from the database.`),
				});
				return;
			}

			if (count === 0) {
				await interaction.editReply({
					content: blockQuote(
						`ℹ️ ${bold("Nothing to clear")} — ${userMention(targetUser.id)} has no warnings on this server.`,
					),
				});
				return;
			}

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("🧹 Clear All Warnings")
						.setDescription(
							`You are about to delete ${bold(`all ${count} warning${count !== 1 ? "s" : ""}`)} from ${userMention(targetUser.id)}.\n⚠️ ${bold("This action cannot be undone.")}`,
						)
						.setColor(Colors.Yellow)
						.addFields(
							{
								name: "🎯 Target",
								value: blockQuote(
									[
										`${inlineCode("User:")}     ${bold(targetUser.tag)}`,
										`${inlineCode("ID:")}       ${inlineCode(targetUser.id)}`,
										`${inlineCode("Warnings:")} ${bold(String(count))} will be deleted`,
									].join("\n"),
								),
								inline: true,
							},
							executorField(executor),
							reasonField(reason),
							requestedAtField(),
						)
						.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
						.setTimestamp(),
				],
				components: [buildConfirmRow(WARN_CLEAR_CONFIRM_ID, WARN_CLEAR_CANCEL_ID, "Confirm Clear", "🧹")],
			});

			createConfirmationCollector({
				interaction,
				confirmId: WARN_CLEAR_CONFIRM_ID,
				cancelId: WARN_CLEAR_CANCEL_ID,
				cancelledAction: "clear",
				timedOutMessage: "The clear was not performed.",
				buildConfirmRowDisabled: () =>
					buildConfirmRow(
						WARN_CLEAR_CONFIRM_ID,
						WARN_CLEAR_CANCEL_ID,
						"Confirm Clear",
						"🧹",
						undefined,
						true,
					),
				onConfirm: async () => {
					const startedAt = new Date();

					try {
						await db
							.delete(warnings)
							.where(and(eq(warnings.guildId, interaction.guildId), eq(warnings.userId, targetUser.id)));
					} catch (err) {
						log.error({ err, targetId: targetUser.id }, "Failed to clear warnings");
						await interaction.editReply({
							content: blockQuote(`❌ ${bold("Failed")} — Could not clear warnings from the database.`),
							components: [],
						});
						return;
					}

					log.info(
						{ targetId: targetUser.id, executorId: executor.id, count, reason },
						`${executor.user.tag} cleared ${count} warning(s) from ${targetUser.tag}`,
					);

					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle("✅ Warnings Cleared")
								.setDescription(
									`All ${bold(`${count} warning${count !== 1 ? "s" : ""}`)} from ${userMention(targetUser.id)} have been removed.`,
								)
								.setColor(Colors.Green)
								.addFields(
									{
										name: "🎯 Target",
										value: blockQuote(
											[
												`${inlineCode("User:")}     ${bold(targetUser.tag)}`,
												`${inlineCode("ID:")}       ${inlineCode(targetUser.id)}`,
												`${inlineCode("Cleared:")}  ${bold(String(count))} warning${count !== 1 ? "s" : ""}`,
											].join("\n"),
										),
										inline: true,
									},
									executorFieldWithDuration(executor.user, startedAt),
									reasonField(reason),
								)
								.setFooter({ text: "Zen • Moderation" })
								.setTimestamp(),
						],
						components: [],
					});
				},
			});
		}
	},
});
