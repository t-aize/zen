import {
	blockQuote,
	bold,
	type ChatInputCommandInteraction,
	Colors,
	channelMention,
	EmbedBuilder,
	inlineCode,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	TimestampStyles,
	time,
} from "discord.js";
import { and, eq } from "drizzle-orm";
import { defineCommand } from "@/commands/index.js";
import { db } from "@/db/index.js";
import { AUDIT_LOG_CATEGORIES, type AuditLogCategory, auditLogConfig } from "@/db/schema/index.js";
import { createLogger } from "@/utils/logger.js";

const log = createLogger("auditlog");

const CATEGORY_EMOJI: Record<AuditLogCategory, string> = {
	channel: "📁",
	thread: "🧵",
	member: "👤",
	role: "🎭",
	message: "💬",
	moderation: "🔨",
	voice: "🔊",
	server: "🏠",
};

defineCommand({
	data: new SlashCommandBuilder()
		.setName("auditlog")
		.setDescription("Configure the audit log channels for this server.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.setNSFW(false)
		.addSubcommand((sub) =>
			sub
				.setName("set")
				.setDescription("Assign a log channel to a category.")
				.addStringOption((opt) =>
					opt
						.setName("category")
						.setDescription("The event category to configure.")
						.setRequired(true)
						.addChoices(
							...AUDIT_LOG_CATEGORIES.map((c) => ({
								name: `${CATEGORY_EMOJI[c]} ${c.charAt(0).toUpperCase() + c.slice(1)}`,
								value: c,
							})),
						),
				)
				.addChannelOption((opt) =>
					opt.setName("channel").setDescription("The text channel to send logs to.").setRequired(true),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("disable")
				.setDescription("Disable logging for a category without removing the config.")
				.addStringOption((opt) =>
					opt
						.setName("category")
						.setDescription("The event category to disable.")
						.setRequired(true)
						.addChoices(
							...AUDIT_LOG_CATEGORIES.map((c) => ({
								name: `${CATEGORY_EMOJI[c]} ${c.charAt(0).toUpperCase() + c.slice(1)}`,
								value: c,
							})),
						),
				),
		)
		.addSubcommand((sub) =>
			sub
				.setName("enable")
				.setDescription("Re-enable logging for a previously disabled category.")
				.addStringOption((opt) =>
					opt
						.setName("category")
						.setDescription("The event category to re-enable.")
						.setRequired(true)
						.addChoices(
							...AUDIT_LOG_CATEGORIES.map((c) => ({
								name: `${CATEGORY_EMOJI[c]} ${c.charAt(0).toUpperCase() + c.slice(1)}`,
								value: c,
							})),
						),
				),
		)
		.addSubcommand((sub) =>
			sub.setName("status").setDescription("View the current audit log configuration for this server."),
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

		const sub = interaction.options.getSubcommand(true) as "set" | "disable" | "enable" | "status";

		if (sub === "set") {
			const category = interaction.options.getString("category", true) as AuditLogCategory;
			const targetChannel = interaction.options.getChannel("channel", true);

			if (!("send" in targetChannel)) {
				await interaction.editReply({
					content: blockQuote(
						`⛔ ${bold("Invalid channel")} — ${channelMention(targetChannel.id)} is not a text channel.`,
					),
				});
				return;
			}

			const now = new Date();

			try {
				const existing = await db.query.auditLogConfig.findFirst({
					where: and(eq(auditLogConfig.guildId, interaction.guildId), eq(auditLogConfig.category, category)),
				});

				if (existing) {
					await db
						.update(auditLogConfig)
						.set({ channelId: targetChannel.id, enabled: true, updatedAt: now })
						.where(eq(auditLogConfig.id, existing.id));
				} else {
					await db.insert(auditLogConfig).values({
						guildId: interaction.guildId,
						category,
						channelId: targetChannel.id,
						enabled: true,
						createdAt: now,
						updatedAt: now,
					});
				}
			} catch (err) {
				log.error({ err, guildId: interaction.guildId, category }, "Failed to upsert audit log config");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not save the configuration.`),
				});
				return;
			}

			log.info(
				{
					guildId: interaction.guildId,
					category,
					channelId: targetChannel.id,
					executorId: interaction.user.id,
				},
				`Audit log category "${category}" set to #${targetChannel.name}`,
			);

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("✅ Audit Log Configured")
						.setDescription(
							`${CATEGORY_EMOJI[category]} ${bold(category)} logs will now be sent to ${channelMention(targetChannel.id)}.`,
						)
						.setColor(Colors.Green)
						.addFields(
							{
								name: "📋 Configuration",
								value: blockQuote(
									[
										`${inlineCode("Category:")} ${bold(category)}`,
										`${inlineCode("Channel:")}  ${channelMention(targetChannel.id)} (${inlineCode(targetChannel.id)})`,
										`${inlineCode("Status:")}   ${bold("Enabled")}`,
									].join("\n"),
								),
								inline: true,
							},
							{
								name: "🛡️ Configured By",
								value: blockQuote(
									[
										`${inlineCode("User:")} ${bold(interaction.user.tag)}`,
										`${inlineCode("ID:")}   ${inlineCode(interaction.user.id)}`,
									].join("\n"),
								),
								inline: true,
							},
						)
						.setFooter({ text: "Zen • Audit Log" })
						.setTimestamp(),
				],
			});
			return;
		}

		if (sub === "disable" || sub === "enable") {
			const category = interaction.options.getString("category", true) as AuditLogCategory;
			const enabling = sub === "enable";
			const now = new Date();

			let existing: typeof auditLogConfig.$inferSelect | undefined;

			try {
				existing = await db.query.auditLogConfig.findFirst({
					where: and(eq(auditLogConfig.guildId, interaction.guildId), eq(auditLogConfig.category, category)),
				});
			} catch (err) {
				log.error({ err, guildId: interaction.guildId, category }, "Failed to fetch audit log config");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch the configuration.`),
				});
				return;
			}

			if (!existing) {
				await interaction.editReply({
					content: blockQuote(
						`⛔ ${bold("Not configured")} — The ${bold(category)} category has no channel set. Use ${inlineCode("/auditlog set")} first.`,
					),
				});
				return;
			}

			if (existing.enabled === enabling) {
				await interaction.editReply({
					content: blockQuote(
						`ℹ️ ${bold("No change")} — The ${bold(category)} category is already ${bold(enabling ? "enabled" : "disabled")}.`,
					),
				});
				return;
			}

			try {
				await db
					.update(auditLogConfig)
					.set({ enabled: enabling, updatedAt: now })
					.where(eq(auditLogConfig.id, existing.id));
			} catch (err) {
				log.error({ err, guildId: interaction.guildId, category }, `Failed to ${sub} audit log category`);
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not update the configuration.`),
				});
				return;
			}

			log.info(
				{ guildId: interaction.guildId, category, enabled: enabling, executorId: interaction.user.id },
				`Audit log category "${category}" ${enabling ? "enabled" : "disabled"}`,
			);

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle(enabling ? "✅ Category Enabled" : "🔕 Category Disabled")
						.setDescription(
							enabling
								? `${CATEGORY_EMOJI[category]} ${bold(category)} logs are now ${bold("active")} in ${channelMention(existing.channelId)}.`
								: `${CATEGORY_EMOJI[category]} ${bold(category)} logs have been ${bold("paused")}. The channel config is preserved.`,
						)
						.setColor(enabling ? Colors.Green : Colors.Grey)
						.addFields({
							name: "📋 Configuration",
							value: blockQuote(
								[
									`${inlineCode("Category:")} ${bold(category)}`,
									`${inlineCode("Channel:")}  ${channelMention(existing.channelId)}`,
									`${inlineCode("Status:")}   ${bold(enabling ? "Enabled" : "Disabled")}`,
								].join("\n"),
							),
							inline: false,
						})
						.setFooter({ text: "Zen • Audit Log" })
						.setTimestamp(),
				],
			});
			return;
		}

		if (sub === "status") {
			let configs: (typeof auditLogConfig.$inferSelect)[];

			try {
				configs = await db.query.auditLogConfig.findMany({
					where: eq(auditLogConfig.guildId, interaction.guildId),
				});
			} catch (err) {
				log.error({ err, guildId: interaction.guildId }, "Failed to fetch audit log configs");
				await interaction.editReply({
					content: blockQuote(`❌ ${bold("Failed")} — Could not fetch the configuration.`),
				});
				return;
			}

			const configMap = new Map(configs.map((c) => [c.category, c]));

			const rows = AUDIT_LOG_CATEGORIES.map((category) => {
				const config = configMap.get(category);
				const emoji = CATEGORY_EMOJI[category];

				if (!config) {
					return `${emoji} ${bold(category)} — ${inlineCode("Not configured")}`;
				}

				const status = config.enabled ? "🟢" : "🔴";
				return `${emoji} ${bold(category)} — ${status} ${channelMention(config.channelId)}`;
			});

			const configured = configs.filter((c) => c.enabled).length;
			const lastUpdated = configs.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setTitle("📊 Audit Log Status")
						.setDescription(
							`${bold(String(configured))}/${bold(String(AUDIT_LOG_CATEGORIES.length))} categories are currently active.`,
						)
						.setColor(configured > 0 ? Colors.Blue : Colors.Grey)
						.addFields(
							{
								name: "📋 Categories",
								value: blockQuote(rows.join("\n")),
								inline: false,
							},
							...(lastUpdated
								? [
										{
											name: "🕐 Last Updated",
											value: blockQuote(
												`${time(lastUpdated.updatedAt, TimestampStyles.FullDateShortTime)} (${time(lastUpdated.updatedAt, TimestampStyles.RelativeTime)})`,
											),
											inline: false,
										},
									]
								: []),
						)
						.setFooter({ text: "Zen • Audit Log" })
						.setTimestamp(),
				],
			});
		}
	},
});
