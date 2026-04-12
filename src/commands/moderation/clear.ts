import { defineCommand } from "@zen/commands";
import { createLogger } from "@zen/utils/logger";
import {
	ActionRowBuilder,
	ApplicationIntegrationType,
	blockQuote,
	bold,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	ComponentType,
	EmbedBuilder,
	escapeMarkdown,
	inlineCode,
	InteractionContextType,
	italic,
	type Message,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
	time,
	TimestampStyles,
	type User,
} from "discord.js";

const log = createLogger("clear");

// ─── Constants ───────────────────────────────────────────────────────────────

const COLLECTOR_IDLE_MS = 180_000;
const BULK_DELETE_LIMIT = 100;
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;
const REASON_PREVIEW_LIMIT = 140;

const EMBED_COLOR_INFO = 0x0ea5e9;
const EMBED_COLOR_SUCCESS = 0x22c55e;
const EMBED_COLOR_WARN = 0xf59e0b;
const EMBED_COLOR_ERROR = 0xef4444;
const EMBED_COLOR_MUTED = 0x64748b;

const BUTTON_ID_CONFIRM = "clear:confirm";
const BUTTON_ID_REFRESH = "clear:refresh";
const BUTTON_ID_CANCEL = "clear:cancel";

const REQUIRED_BOT_PERMISSIONS = [
	{ bit: PermissionFlagsBits.ViewChannel, label: "View Channel" },
	{ bit: PermissionFlagsBits.ReadMessageHistory, label: "Read Message History" },
	{ bit: PermissionFlagsBits.ManageMessages, label: "Manage Messages" },
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface BulkDeleteCapableChannel {
	readonly id: string;
	readonly guildId: string;
	readonly name: string;
	readonly messages: {
		fetch: (options: { limit: number }) => Promise<Collection<string, Message>>;
	};
	bulkDelete: (
		messages: number | Collection<string, Message>,
		filterOld?: boolean,
	) => Promise<Collection<string, Message>>;
	toString: () => string;
}

interface ClearOptions {
	readonly amount: number;
	readonly targetUser: User | null;
	readonly includePinned: boolean;
	readonly reason: string | null;
	readonly skipConfirmation: boolean;
}

interface ClearPreview {
	readonly scanLimit: number;
	readonly scannedCount: number;
	readonly matchedCount: number;
	readonly selectedMessages: Collection<string, Message>;
	readonly skippedTooOld: number;
	readonly skippedPinned: number;
	readonly skippedByAuthor: number;
	readonly uniqueAuthorCount: number;
	readonly attachmentCount: number;
	readonly newestSelectedAt: Date | null;
	readonly oldestSelectedAt: Date | null;
	readonly generatedAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
	count === 1 ? singular : plural;

const truncateText = (value: string, maxLength: number): string => {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const formatReason = (reason: string | null): string => {
	if (!reason) return italic("No reason provided");
	return inlineCode(
		escapeMarkdown(truncateText(reason.replace(/\s+/g, " ").trim(), REASON_PREVIEW_LIMIT)),
	);
};

const formatCount = (count: number, noun: string): string =>
	inlineCode(`${count} ${pluralize(count, noun)}`);

const formatTimestamp = (value: Date | null): string => {
	if (!value) return italic("No eligible messages in scope");
	return `${time(value, TimestampStyles.RelativeTime)}  -  ${italic(inlineCode(value.toISOString()))}`;
};

const buildFooter = (text: string, avatarUrl?: string) =>
	avatarUrl ? { text, iconURL: avatarUrl } : { text };

const buildChannelUrl = (guildId: string, channelId: string): string =>
	`https://discord.com/channels/${guildId}/${channelId}`;

const isBulkDeleteCapableChannel = (channel: unknown): channel is BulkDeleteCapableChannel => {
	if (typeof channel !== "object" || channel === null) return false;
	if (!("isTextBased" in channel) || typeof channel.isTextBased !== "function") return false;

	const candidate = channel as {
		bulkDelete?: unknown;
		isTextBased: () => boolean;
		messages?: unknown;
	};

	if (!candidate.isTextBased()) return false;
	if (typeof candidate.bulkDelete !== "function") return false;
	if (typeof candidate.messages !== "object" || candidate.messages === null) {
		return false;
	}

	return "fetch" in candidate.messages && typeof candidate.messages.fetch === "function";
};

const collectClearPreview = async (
	channel: BulkDeleteCapableChannel,
	options: ClearOptions,
): Promise<ClearPreview> => {
	const scanLimit = Math.min(BULK_DELETE_LIMIT, Math.max(options.amount * 3, 25));
	const fetchedMessages = await channel.messages.fetch({ limit: scanLimit });
	const cutoffTimestamp = Date.now() - BULK_DELETE_MAX_AGE_MS;

	const recentMessages = fetchedMessages.filter(
		(message) => message.createdTimestamp >= cutoffTimestamp,
	);
	const skippedTooOld = fetchedMessages.size - recentMessages.size;

	const unpinnedMessages = options.includePinned
		? recentMessages
		: recentMessages.filter((message) => !message.pinned);
	const skippedPinned = options.includePinned ? 0 : recentMessages.size - unpinnedMessages.size;

	const matchedMessages = options.targetUser
		? unpinnedMessages.filter((message) => message.author.id === options.targetUser?.id)
		: unpinnedMessages;
	const skippedByAuthor = options.targetUser ? unpinnedMessages.size - matchedMessages.size : 0;

	const selectedMessages = new Collection<string, Message>(
		[...matchedMessages.entries()].slice(0, options.amount),
	);

	const selectedValues = [...selectedMessages.values()];
	const uniqueAuthorCount = new Set(selectedValues.map((message) => message.author.id)).size;
	const attachmentCount = selectedValues.reduce(
		(total, message) => total + message.attachments.size,
		0,
	);

	return {
		scanLimit,
		scannedCount: fetchedMessages.size,
		matchedCount: matchedMessages.size,
		selectedMessages,
		skippedTooOld,
		skippedPinned,
		skippedByAuthor,
		uniqueAuthorCount,
		attachmentCount,
		newestSelectedAt: selectedMessages.first()?.createdAt ?? null,
		oldestSelectedAt: selectedMessages.last()?.createdAt ?? null,
		generatedAt: new Date(),
	};
};

// ─── Embed Builders ──────────────────────────────────────────────────────────

const buildValidationEmbed = (
	title: string,
	description: string,
	avatarUrl?: string,
): EmbedBuilder => {
	return new EmbedBuilder()
		.setColor(EMBED_COLOR_ERROR)
		.setTitle(title)
		.setThumbnail(avatarUrl ?? null)
		.setDescription(blockQuote(description))
		.setFooter(buildFooter("Moderation  •  Validation failed", avatarUrl))
		.setTimestamp(new Date());
};

const buildPreviewEmbed = (
	channel: BulkDeleteCapableChannel,
	moderatorLabel: string,
	options: ClearOptions,
	preview: ClearPreview,
	refreshCount: number,
	sessionExpiresAt: Date,
	avatarUrl?: string,
): EmbedBuilder => {
	const selectedCount = preview.selectedMessages.size;
	const isPartial = selectedCount > 0 && selectedCount < options.amount;
	const color =
		selectedCount === 0 ? EMBED_COLOR_WARN : isPartial ? EMBED_COLOR_WARN : EMBED_COLOR_INFO;
	const title =
		selectedCount === 0
			? "🧹  Clear — No Eligible Messages"
			: isPartial
				? "🧹  Clear — Partial Preview"
				: "🧹  Clear — Confirmation Required";

	const footerParts = ["Moderation"];
	if (refreshCount > 0) {
		footerParts.push(`Preview refreshed ${refreshCount}x`);
	}

	const description =
		selectedCount === 0
			? [
					`${bold("Nothing eligible")} matched the current purge scope in ${channel.toString()}.`,
					`${bold("Why")} - Messages may be older than ${inlineCode("14 days")}, pinned, or outside the selected author filter.`,
					`${bold("Next step")} - Adjust the options or hit ${inlineCode("Refresh")} if the channel is still moving.`,
				].join("\n")
			: [
					`${bold("Confirmation required")} before anything is deleted in ${channel.toString()}.`,
					`${bold("Preview")} - ${formatCount(selectedCount, "message")} currently ${italic("ready for bulk delete")}.`,
					`${bold("Safety")} - Bulk delete only removes messages newer than ${inlineCode("14 days")}; refresh the snapshot if needed.`,
				].join("\n");

	return new EmbedBuilder()
		.setColor(color)
		.setTitle(title)
		.setThumbnail(avatarUrl ?? null)
		.setDescription(blockQuote(description))
		.addFields(
			{
				name: "🎯  Operation",
				value: blockQuote(
					[
						`📍 Channel:  ${channel.toString()}`,
						`🧹 Requested:  ${formatCount(options.amount, "message")}`,
						`👤 Author filter:  ${options.targetUser ? options.targetUser.toString() : italic("Any author")}`,
						`📌 Include pinned:  ${inlineCode(options.includePinned ? "Yes" : "No")}`,
						`📝 Reason:  ${formatReason(options.reason)}`,
					].join("\n"),
				),
				inline: false,
			},
			{
				name: "📊  Scan Snapshot",
				value: blockQuote(
					[
						`🔎 Scanned:  ${formatCount(preview.scannedCount, "message")} / ${inlineCode(String(preview.scanLimit))}`,
						`✅ Matched filters:  ${formatCount(preview.matchedCount, "message")}`,
						`🚀 Ready now:  ${formatCount(selectedCount, "message")}`,
						`⌛ Too old:  ${formatCount(preview.skippedTooOld, "message")}`,
						`📍 Skipped pinned:  ${formatCount(preview.skippedPinned, "message")}`,
						options.targetUser
							? `👥 Filtered out by author:  ${formatCount(preview.skippedByAuthor, "message")}`
							: `👥 Unique authors in scope:  ${inlineCode(String(preview.uniqueAuthorCount))}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🛡️  Safety",
				value: blockQuote(
					[
						`👮 Moderator:  ${moderatorLabel}`,
						`🤖 Bot access:  ${inlineCode("Ready")}`,
						`⏳ Session expires:  ${time(sessionExpiresAt, TimestampStyles.RelativeTime)}`,
						`🔄 Preview refreshes:  ${inlineCode(String(refreshCount))}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🕐  Selection Window",
				value: blockQuote(
					[
						`🆕 Newest selected:  ${formatTimestamp(preview.newestSelectedAt)}`,
						`🗂️ Oldest selected:  ${formatTimestamp(preview.oldestSelectedAt)}`,
						`📎 Attachments in scope:  ${inlineCode(String(preview.attachmentCount))}`,
						`🕒 Generated:  ${time(preview.generatedAt, TimestampStyles.RelativeTime)}`,
					].join("\n"),
				),
				inline: false,
			},
		)
		.setFooter(buildFooter(footerParts.join("  •  "), avatarUrl))
		.setTimestamp(preview.generatedAt);
};

const buildProgressEmbed = (
	channel: BulkDeleteCapableChannel,
	options: ClearOptions,
	preview: ClearPreview,
	avatarUrl?: string,
): EmbedBuilder => {
	return new EmbedBuilder()
		.setColor(EMBED_COLOR_INFO)
		.setTitle("🧹  Clear — Purge In Progress")
		.setThumbnail(avatarUrl ?? null)
		.setDescription(
			blockQuote(
				[
					`${bold("Deleting messages now")} in ${channel.toString()}.`,
					`${bold("Target scope")} - ${formatCount(preview.selectedMessages.size, "message")} selected from the last preview.`,
					`${bold("Reason")} - ${formatReason(options.reason)}.`,
				].join("\n"),
			),
		)
		.setFooter(buildFooter("Moderation  •  Executing purge", avatarUrl))
		.setTimestamp(new Date());
};

const buildResultEmbed = (
	channel: BulkDeleteCapableChannel,
	moderatorLabel: string,
	options: ClearOptions,
	preview: ClearPreview,
	deletedCount: number,
	avatarUrl?: string,
): EmbedBuilder => {
	const selectedCount = preview.selectedMessages.size;
	const unresolvedCount = Math.max(0, selectedCount - deletedCount);
	const color = deletedCount > 0 ? EMBED_COLOR_SUCCESS : EMBED_COLOR_WARN;
	const title = deletedCount > 0 ? "✅  Clear — Purge Completed" : "⚠️  Clear — Nothing Deleted";

	const description =
		deletedCount > 0
			? [
					`${bold("Purge completed")} in ${channel.toString()}.`,
					`${bold("Deleted")} - ${formatCount(deletedCount, "message")}${unresolvedCount > 0 ? `, with ${formatCount(unresolvedCount, "message")} no longer available at execution time` : ""}.`,
					`${bold("Scope")} - Requested ${formatCount(options.amount, "message")}, confirmed from a preview of ${formatCount(selectedCount, "message")}.`,
				].join("\n")
			: [
					`${bold("No messages were deleted")} in ${channel.toString()}.`,
					`${bold("Most likely")} - The selected messages were already removed, became too old, or the preview no longer matched.`,
					`${bold("Tip")} - Re-run ${inlineCode("/clear")} for a fresh snapshot.`,
				].join("\n");

	return new EmbedBuilder()
		.setColor(color)
		.setTitle(title)
		.setThumbnail(avatarUrl ?? null)
		.setDescription(blockQuote(description))
		.addFields(
			{
				name: "📦  Outcome",
				value: blockQuote(
					[
						`🗑️ Deleted:  ${formatCount(deletedCount, "message")}`,
						`📥 Preview scope:  ${formatCount(selectedCount, "message")}`,
						`❓ Unresolved at execution:  ${formatCount(unresolvedCount, "message")}`,
						`⌛ Excluded for age in preview:  ${formatCount(preview.skippedTooOld, "message")}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "🎯  Filters",
				value: blockQuote(
					[
						`👤 Author filter:  ${options.targetUser ? options.targetUser.toString() : italic("Any author")}`,
						`📌 Included pinned:  ${inlineCode(options.includePinned ? "Yes" : "No")}`,
						`👥 Unique authors removed:  ${inlineCode(String(preview.uniqueAuthorCount))}`,
						`📎 Attachments removed:  ${inlineCode(String(preview.attachmentCount))}`,
					].join("\n"),
				),
				inline: true,
			},
			{
				name: "📝  Audit Context",
				value: blockQuote(
					[
						`👮 Moderator:  ${moderatorLabel}`,
						`🧹 Requested:  ${formatCount(options.amount, "message")}`,
						`📝 Reason:  ${formatReason(options.reason)}`,
						`🕒 Executed:  ${time(new Date(), TimestampStyles.RelativeTime)}`,
					].join("\n"),
				),
				inline: false,
			},
		)
		.setFooter(buildFooter("Moderation  •  Purge finalised", avatarUrl))
		.setTimestamp(new Date());
};

const buildCancelledEmbed = (
	channel: BulkDeleteCapableChannel,
	moderatorLabel: string,
	options: ClearOptions,
	preview: ClearPreview,
	avatarUrl?: string,
): EmbedBuilder => {
	return new EmbedBuilder()
		.setColor(EMBED_COLOR_MUTED)
		.setTitle("🛑  Clear — Cancelled")
		.setThumbnail(avatarUrl ?? null)
		.setDescription(
			blockQuote(
				[
					`${bold("Purge cancelled")} before any message was deleted in ${channel.toString()}.`,
					`${bold("Last preview")} - ${formatCount(preview.selectedMessages.size, "message")} were in scope.`,
					`${bold("Moderator")} - ${moderatorLabel}.`,
					`${bold("Reason")} - ${formatReason(options.reason)}.`,
				].join("\n"),
			),
		)
		.setFooter(buildFooter("Moderation  •  Session cancelled", avatarUrl))
		.setTimestamp(new Date());
};

const buildFailureEmbed = (
	channel: BulkDeleteCapableChannel,
	moderatorLabel: string,
	options: ClearOptions,
	avatarUrl?: string,
): EmbedBuilder => {
	return new EmbedBuilder()
		.setColor(EMBED_COLOR_ERROR)
		.setTitle("❌  Clear — Purge Failed")
		.setThumbnail(avatarUrl ?? null)
		.setDescription(
			blockQuote(
				[
					`${bold("The purge could not be completed")} in ${channel.toString()}.`,
					`${bold("Moderator")} - ${moderatorLabel}.`,
					`${bold("Possible causes")} - Missing permissions, deleted messages, or a transient Discord API error.`,
					`${bold("Reason")} - ${formatReason(options.reason)}.`,
				].join("\n"),
			),
		)
		.setFooter(buildFooter("Moderation  •  Execution failed", avatarUrl))
		.setTimestamp(new Date());
};

const executeBulkDelete = async (
	channel: BulkDeleteCapableChannel,
	interaction: { guildId: string; user: { id: string } },
	options: ClearOptions,
	preview: ClearPreview,
): Promise<number> => {
	const deletedMessages = await channel.bulkDelete(preview.selectedMessages, true);
	const deletedCount = deletedMessages.size;

	log.info(
		{
			guild: interaction.guildId,
			channel: channel.id,
			moderator: interaction.user.id,
			amountRequested: options.amount,
			previewed: preview.selectedMessages.size,
			deleted: deletedCount,
			targetUser: options.targetUser?.id,
			includePinned: options.includePinned,
			reason: options.reason,
			skipConfirmation: options.skipConfirmation,
		},
		"Bulk delete completed",
	);

	return deletedCount;
};

// ─── Action Row ──────────────────────────────────────────────────────────────

const buildActionRow = (
	channelUrl: string,
	selectedCount: number,
	options?: {
		readonly disabled?: boolean;
		readonly confirmDisabled?: boolean;
	},
): ActionRowBuilder<ButtonBuilder> => {
	const disabled = options?.disabled ?? false;
	const confirmDisabled = options?.confirmDisabled ?? false;
	const confirmLabel = `Confirm${selectedCount > 0 ? ` (${selectedCount})` : ""}`;

	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(BUTTON_ID_CONFIRM)
			.setLabel(confirmLabel)
			.setEmoji("🧹")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(disabled || confirmDisabled),
		new ButtonBuilder()
			.setCustomId(BUTTON_ID_REFRESH)
			.setLabel("Refresh")
			.setEmoji("🔄")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(BUTTON_ID_CANCEL)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setLabel("Open Channel")
			.setEmoji("🔗")
			.setStyle(ButtonStyle.Link)
			.setURL(channelUrl),
	);
};

// ─── Command Definition ──────────────────────────────────────────────────────

defineCommand({
	data: new SlashCommandBuilder()
		.setName("clear")
		.setDescription("Preview and bulk-delete recent messages with a safe confirmation flow")
		.setContexts(InteractionContextType.Guild)
		.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addIntegerOption((option) =>
			option
				.setName("amount")
				.setDescription("How many recent messages should be targeted (max 100)")
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(BULK_DELETE_LIMIT),
		)
		.addUserOption((option) =>
			option
				.setName("user")
				.setDescription("Only target messages from this user")
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName("include-pinned")
				.setDescription("Include pinned messages in the purge scope")
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName("skip-confirmation")
				.setDescription("Delete immediately without the confirmation step")
				.setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName("reason")
				.setDescription("Internal moderation context for this purge")
				.setRequired(false)
				.setMaxLength(200),
		) as SlashCommandBuilder,
	category: "moderation",
	execute: async (interaction) => {
		if (!(interaction.inGuild() && interaction.guildId)) {
			await interaction.reply({
				embeds: [
					buildValidationEmbed(
						"❌  Clear — Unsupported Context",
						"This command can only be used inside a guild text channel.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		if (!isBulkDeleteCapableChannel(interaction.channel)) {
			await interaction.reply({
				embeds: [
					buildValidationEmbed(
						"❌  Clear — Unsupported Channel",
						"This channel type does not support bulk deletion. Use the command in a standard guild text channel or thread.",
					),
				],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const channel = interaction.channel;
		const avatarUrl = interaction.client.user.displayAvatarURL({ size: 256 });
		const moderatorLabel = interaction.user.toString();
		const reason = interaction.options.getString("reason");
		const options: ClearOptions = {
			amount: interaction.options.getInteger("amount", true),
			targetUser: interaction.options.getUser("user"),
			includePinned: interaction.options.getBoolean("include-pinned") ?? false,
			reason: reason?.trim() ? reason.trim() : null,
			skipConfirmation: interaction.options.getBoolean("skip-confirmation") ?? false,
		};

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const moderatorHasPermission = interaction.memberPermissions.has(
			PermissionFlagsBits.ManageMessages,
		);
		if (!moderatorHasPermission) {
			await interaction.editReply({
				embeds: [
					buildValidationEmbed(
						"❌  Clear — Missing Permission",
						`You need ${inlineCode("Manage Messages")} to run ${inlineCode("/clear")}.`,
						avatarUrl,
					),
				],
				components: [],
			});
			return;
		}

		const missingBotPermissions = REQUIRED_BOT_PERMISSIONS.filter(
			(permission) => !interaction.appPermissions.has(permission.bit),
		);
		if (missingBotPermissions.length > 0) {
			await interaction.editReply({
				embeds: [
					buildValidationEmbed(
						"❌  Clear — Bot Permission Missing",
						`${bold("Required permissions")} - ${missingBotPermissions
							.map((permission) => inlineCode(permission.label))
							.join(", ")}.`,
						avatarUrl,
					),
				],
				components: [],
			});
			return;
		}

		let refreshCount = 0;
		const sessionExpiresAt = new Date(Date.now() + COLLECTOR_IDLE_MS);
		const channelUrl = buildChannelUrl(interaction.guildId, channel.id);
		let preview = await collectClearPreview(channel, options);
		let terminalState: "active" | "confirmed" | "cancelled" | "failed" = "active";

		if (options.skipConfirmation) {
			if (preview.selectedMessages.size === 0) {
				await interaction.editReply({
					embeds: [
						buildPreviewEmbed(
							channel,
							moderatorLabel,
							options,
							preview,
							refreshCount,
							sessionExpiresAt,
							avatarUrl,
						).setFooter(
							buildFooter("Moderation  •  Direct execution found nothing eligible", avatarUrl),
						),
					],
					components: [],
				});
				return;
			}

			try {
				terminalState = "confirmed";

				await interaction.editReply({
					embeds: [buildProgressEmbed(channel, options, preview, avatarUrl)],
					components: [],
				});

				const deletedCount = await executeBulkDelete(channel, interaction, options, preview);

				await interaction.editReply({
					embeds: [
						buildResultEmbed(channel, moderatorLabel, options, preview, deletedCount, avatarUrl),
					],
					components: [],
				});
			} catch (error) {
				terminalState = "failed";

				log.error(
					{
						error,
						guild: interaction.guildId,
						channel: channel.id,
						moderator: interaction.user.id,
						skipConfirmation: options.skipConfirmation,
					},
					"Clear command direct execution failed",
				);

				await interaction.editReply({
					embeds: [buildFailureEmbed(channel, moderatorLabel, options, avatarUrl)],
					components: [],
				});
			}

			return;
		}

		const reply = await interaction.editReply({
			embeds: [
				buildPreviewEmbed(
					channel,
					moderatorLabel,
					options,
					preview,
					refreshCount,
					sessionExpiresAt,
					avatarUrl,
				),
			],
			components: [
				buildActionRow(channelUrl, preview.selectedMessages.size, {
					confirmDisabled: preview.selectedMessages.size === 0,
				}),
			],
		});

		const collector = reply.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (buttonInteraction) =>
				buttonInteraction.user.id === interaction.user.id &&
				[BUTTON_ID_CONFIRM, BUTTON_ID_REFRESH, BUTTON_ID_CANCEL].includes(
					buttonInteraction.customId,
				),
			idle: COLLECTOR_IDLE_MS,
		});

		collector.on("collect", async (buttonInteraction) => {
			try {
				if (buttonInteraction.customId === BUTTON_ID_REFRESH) {
					await buttonInteraction.deferUpdate();
					refreshCount++;
					preview = await collectClearPreview(channel, options);

					await interaction.editReply({
						embeds: [
							buildPreviewEmbed(
								channel,
								moderatorLabel,
								options,
								preview,
								refreshCount,
								sessionExpiresAt,
								avatarUrl,
							),
						],
						components: [
							buildActionRow(channelUrl, preview.selectedMessages.size, {
								confirmDisabled: preview.selectedMessages.size === 0,
							}),
						],
					});
					return;
				}

				if (buttonInteraction.customId === BUTTON_ID_CANCEL) {
					terminalState = "cancelled";

					await buttonInteraction.update({
						embeds: [buildCancelledEmbed(channel, moderatorLabel, options, preview, avatarUrl)],
						components: [
							buildActionRow(channelUrl, preview.selectedMessages.size, {
								disabled: true,
								confirmDisabled: true,
							}),
						],
					});

					collector.stop("cancelled");
					return;
				}

				terminalState = "confirmed";

				await buttonInteraction.update({
					embeds: [buildProgressEmbed(channel, options, preview, avatarUrl)],
					components: [
						buildActionRow(channelUrl, preview.selectedMessages.size, {
							disabled: true,
							confirmDisabled: true,
						}),
					],
				});

				const deletedCount = await executeBulkDelete(channel, interaction, options, preview);

				await interaction.editReply({
					embeds: [
						buildResultEmbed(channel, moderatorLabel, options, preview, deletedCount, avatarUrl),
					],
					components: [
						buildActionRow(channelUrl, preview.selectedMessages.size, {
							disabled: true,
							confirmDisabled: true,
						}),
					],
				});

				collector.stop("confirmed");
			} catch (error) {
				terminalState = "failed";

				if (!(buttonInteraction.deferred || buttonInteraction.replied)) {
					await buttonInteraction.deferUpdate().catch(() => {
						/* interaction already acknowledged */
					});
				}

				log.error(
					{
						error,
						guild: interaction.guildId,
						channel: channel.id,
						moderator: interaction.user.id,
					},
					"Clear command confirmation flow failed",
				);

				await interaction
					.editReply({
						embeds: [buildFailureEmbed(channel, moderatorLabel, options, avatarUrl)],
						components: [
							buildActionRow(channelUrl, preview.selectedMessages.size, {
								disabled: true,
								confirmDisabled: true,
							}),
						],
					})
					.catch(() => {
						/* interaction expired or reply deleted */
					});

				collector.stop("failed");
			}
		});

		collector.on("end", async () => {
			if (terminalState !== "active") return;

			await interaction
				.editReply({
					embeds: [
						buildPreviewEmbed(
							channel,
							moderatorLabel,
							options,
							preview,
							refreshCount,
							sessionExpiresAt,
							avatarUrl,
						).setFooter(buildFooter("Moderation  •  Session expired", avatarUrl)),
					],
					components: [
						buildActionRow(channelUrl, preview.selectedMessages.size, {
							disabled: true,
							confirmDisabled: true,
						}),
					],
				})
				.catch(() => {
					/* interaction expired or reply deleted */
				});
		});
	},
});
