import {
	blockQuote,
	bold,
	Colors,
	EmbedBuilder,
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
import { notes } from "@/db/schema/index.js";
import { createLogger } from "@/utils/logger.js";
import {
	buildConfirmRow,
	createConfirmationCollector,
	ensureGuild,
	executorField,
	executorFieldWithDuration,
	requestedAtField,
} from "@/utils/moderation.js";

const REMOVE_CONFIRM_ID = "note:remove:confirm";
const REMOVE_CANCEL_ID = "note:remove:cancel";

const NOTES_PER_PAGE = 5;

const log = createLogger("note");

defineCommand({
	data: new SlashCommandBuilder()
		.setName("note")
		.setDescription("Manage internal staff notes on members.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.setNSFW(false)
		.addSubcommand((sub) =>
			sub
				.setName("add")
				.setDescription("Add a note on a member.")
				.addUserOption((opt) =>
					opt.setName("user").setDescription("The member to add a note on.").setRequired(true),
				)
				.addStringOption((opt) =>
					opt.setName("content").setDescription("The note content.").setMaxLength(1024).setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("list")
				.setDescription("List all notes for a member.")
				.addUserOption((opt) => opt.setName("user").setDescription("The member to look up.").setRequired(true))
				.addIntegerOption((opt) =>
					opt.setName("page").setDescription("Page number.").setMinValue(1).setRequired(false),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("remove")
				.setDescription("Remove a specific note by its ID.")
				.addStringOption((opt) =>
					opt.setName("id").setDescription("The note ID to remove.").setMinLength(1).setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("clear")
				.setDescription("Clear all notes for a member.")
				.addUserOption((opt) =>
					opt.setName("user").setDescription("The member to clear notes for.").setRequired(true),
				),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		const sub = interaction.options.getSubcommand(true) as "add" | "list" | "remove" | "clear";

		if (sub === "add") {
			await interaction.deferReply({ flags: 64 });

			const targetUser = interaction.options.getUser("user", true);
			const content = interaction.options.getString("content", true);
			const executor = interaction.member;
			const startedAt = new Date();

			try {
				const result = await db
					.insert(notes)
					.values({
						guildId: interaction.guildId,
						userId: targetUser.id,
						moderatorId: executor.id,
						moderatorTag: executor.user.tag,
						content,
						createdAt: startedAt,
					})
					.returning({ id: notes.id });

				const inserted = result[0];

				if (!inserted) {
					await interaction.editReply({
						content: blockQuote(`❌ ${bold("Failed")} — Could not save the note.`),
					});
					return;
				}

				log.info(
					{ noteId: inserted.id, targetId: targetUser.id, executorId: executor.id },
					`${executor.user.tag} added a note on ${targetUser.tag}`,
				);

				const all = await db.query.notes.findMany({
					where: (n, { eq, and }) => and(eq(n.guildId, interaction.guildId), eq(n.userId, targetUser.id)),
				});

				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setTitle("📝 Note Added")
							.setDescription(`A note has been added on ${userMention(targetUser.id)}.`)
							.setColor(Colors.Green)
							.addFields(
								{
									name: "👤 Target",
									value: blockQuote(
										[
											`${inlineCode("User:")}  ${bold(targetUser.tag)}`,
											`${inlineCode("ID:")}    ${inlineCode(targetUser.id)}`,
											`${inlineCode("Notes:")} ${bold(String(all.length))} total`,
										].join("\n"),
									),
									inline: true,
								},
								executorFieldWithDuration(executor.user, startedAt),
								{
									name: "📝 Content",
									value: blockQuote(content),
									inline: false,
								},
								{
									name: "🪪 Note ID",
									value: blockQuote(`${inlineCode("ID:")} ${bold(inserted.id)}`),
									inline: false,
								},
							)
							.setFooter({ text: "Zen • Moderation" })
							.setTimestamp(),
					],
				});
			} catch (err) {
				log.error({ err, targetId: targetUser.id }, "Failed to insert note");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — An unexpected error occurred while saving the note.`),
				});
			}

			return;
		}

		if (sub === "list") {
			await interaction.deferReply({ flags: 64 });

			const targetUser = interaction.options.getUser("user", true);
			const page = interaction.options.getInteger("page") ?? 1;

			let all: (typeof notes.$inferSelect)[];

			try {
				all = await db.query.notes.findMany({
					where: (n, { eq, and }) => and(eq(n.guildId, interaction.guildId), eq(n.userId, targetUser.id)),
				});
				all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
			} catch (err) {
				log.error({ err, userId: targetUser.id }, "Failed to fetch notes");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch notes from the database.`),
				});
				return;
			}

			const totalPages = Math.max(1, Math.ceil(all.length / NOTES_PER_PAGE));
			const safePage = Math.min(page, totalPages);
			const pageNotes = all.slice((safePage - 1) * NOTES_PER_PAGE, safePage * NOTES_PER_PAGE);
			const hasNotes = all.length > 0;

			const embed = new EmbedBuilder()
				.setTitle(`📋 Notes — ${targetUser.tag}`)
				.setThumbnail(targetUser.displayAvatarURL())
				.setColor(hasNotes ? Colors.Blurple : Colors.Green)
				.setFooter({
					text: `Zen • Moderation${totalPages > 1 ? ` — Page ${safePage}/${totalPages}` : ""}`,
				})
				.setTimestamp();

			if (!hasNotes) {
				embed.setDescription(`${userMention(targetUser.id)} has ${bold("no notes")} on this server.`);
			} else {
				embed.setDescription(
					`${userMention(targetUser.id)} has ${bold(`${all.length} note${all.length !== 1 ? "s" : ""}`)} on this server.`,
				);

				embed.addFields(
					...pageNotes.map((n, i) => {
						const num = (safePage - 1) * NOTES_PER_PAGE + i + 1;
						return {
							name: `${bold(`#${num}`)} · ${time(n.createdAt, TimestampStyles.ShortDate)} · ${inlineCode(n.id)}`,
							value: blockQuote(
								[
									n.content,
									`— ${bold(n.moderatorTag)}, ${time(n.createdAt, TimestampStyles.RelativeTime)}`,
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

			const noteId = interaction.options.getString("id", true);
			const executor = interaction.member;

			let note: typeof notes.$inferSelect | undefined;

			try {
				note = await db.query.notes.findFirst({
					where: (n, { eq, and }) => and(eq(n.id, noteId), eq(n.guildId, interaction.guildId)),
				});
			} catch (err) {
				log.error({ err, noteId }, "Failed to fetch note");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch the note from the database.`),
				});
				return;
			}

			if (!note) {
				await interaction.editReply({
					content: blockQuote(
						`⛔ ${bold("Not found")} — No note with ID ${inlineCode(noteId)} exists on this server.`,
					),
				});
				return;
			}

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("🗑️ Remove Note")
						.setDescription(
							`You are about to remove note ${inlineCode(noteId)} from ${userMention(note.userId)}.`,
						)
						.setColor(Colors.Yellow)
						.addFields(
							{
								name: "📝 Note",
								value: blockQuote(
									[
										`${inlineCode("ID:")}     ${bold(noteId)}`,
										`${inlineCode("User:")}   ${userMention(note.userId)}`,
										`${inlineCode("By:")}     ${bold(note.moderatorTag)}`,
										`${inlineCode("At:")}     ${time(note.createdAt, TimestampStyles.FullDateShortTime)}`,
										`${inlineCode("Content:")} ${note.content.length > 100 ? `${note.content.slice(0, 100)}…` : note.content}`,
									].join("\n"),
								),
								inline: false,
							},
							executorField(executor),
							requestedAtField(),
						)
						.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
						.setTimestamp(),
				],
				components: [buildConfirmRow(REMOVE_CONFIRM_ID, REMOVE_CANCEL_ID, "Confirm Remove", "🗑️")],
			});

			createConfirmationCollector({
				interaction,
				confirmId: REMOVE_CONFIRM_ID,
				cancelId: REMOVE_CANCEL_ID,
				cancelledAction: "removal",
				timedOutMessage: "The removal was not performed.",
				buildConfirmRowDisabled: () =>
					buildConfirmRow(REMOVE_CONFIRM_ID, REMOVE_CANCEL_ID, "Confirm Remove", "🗑️", undefined, true),
				onConfirm: async () => {
					const startedAt = new Date();

					try {
						await db
							.delete(notes)
							.where(and(eq(notes.id, note!.id), eq(notes.guildId, interaction.guildId)));
					} catch (err) {
						log.error({ err, noteId }, "Failed to delete note");
						await interaction.editReply({
							content: blockQuote(`❌ ${bold("Failed")} — Could not delete the note.`),
							components: [],
						});
						return;
					}

					log.info(
						{ noteId, targetId: note!.userId, executorId: executor.id },
						`${executor.user.tag} removed note ${noteId}`,
					);

					await interaction.editReply({
						embeds: [
							new EmbedBuilder()
								.setTitle("✅ Note Removed")
								.setDescription(
									`Note ${inlineCode(noteId)} has been removed from ${userMention(note!.userId)}.`,
								)
								.setColor(Colors.Green)
								.addFields(executorFieldWithDuration(executor.user, startedAt))
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
			const executor = interaction.member;

			let count: number;

			try {
				const existing = await db.query.notes.findMany({
					where: (n, { eq, and }) => and(eq(n.guildId, interaction.guildId), eq(n.userId, targetUser.id)),
				});
				count = existing.length;
			} catch (err) {
				log.error({ err, targetId: targetUser.id }, "Failed to fetch notes for clear");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch notes from the database.`),
				});
				return;
			}

			if (count === 0) {
				await interaction.editReply({
					content: blockQuote(
						`ℹ️ ${bold("Nothing to clear")} — ${userMention(targetUser.id)} has no notes on this server.`,
					),
				});
				return;
			}

			const startedAt = new Date();

			try {
				await db
					.delete(notes)
					.where(and(eq(notes.guildId, interaction.guildId), eq(notes.userId, targetUser.id)));
			} catch (err) {
				log.error({ err, targetId: targetUser.id }, "Failed to clear notes");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not clear notes from the database.`),
				});
				return;
			}

			log.info(
				{ targetId: targetUser.id, executorId: executor.id, count },
				`${executor.user.tag} cleared ${count} note(s) from ${targetUser.tag}`,
			);

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("✅ Notes Cleared")
						.setDescription(
							`All ${bold(`${count} note${count !== 1 ? "s" : ""}`)} from ${userMention(targetUser.id)} have been removed.`,
						)
						.setColor(Colors.Green)
						.addFields(
							{
								name: "👤 Target",
								value: blockQuote(
									[
										`${inlineCode("User:")}    ${bold(targetUser.tag)}`,
										`${inlineCode("ID:")}      ${inlineCode(targetUser.id)}`,
										`${inlineCode("Cleared:")} ${bold(String(count))} note${count !== 1 ? "s" : ""}`,
									].join("\n"),
								),
								inline: true,
							},
							executorFieldWithDuration(executor.user, startedAt),
						)
						.setFooter({ text: "Zen • Moderation" })
						.setTimestamp(),
				],
			});
		}
	},
});
