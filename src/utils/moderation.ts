import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	blockQuote,
	bold,
	type ChatInputCommandInteraction,
	Colors,
	EmbedBuilder,
	type GuildMember,
	inlineCode,
	MessageFlags,
	TimestampStyles,
	time,
	userMention,
} from "discord.js";

/**
 * Generic confirmation button row used by all moderation commands.
 */
export const buildConfirmRow = (
	confirmId: string,
	cancelId: string,
	label: string,
	emoji: string,
	style: ButtonStyle = ButtonStyle.Danger,
	disabled = false,
) =>
	new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(confirmId)
			.setLabel(label)
			.setEmoji(emoji)
			.setStyle(style)
			.setDisabled(disabled),
		new ButtonBuilder()
			.setCustomId(cancelId)
			.setLabel("Cancel")
			.setEmoji("✖️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled),
	);

/**
 * Embed shown when the user cancels a moderation action.
 */
export const buildCancelledEmbed = (action: string) =>
	new EmbedBuilder()
		.setTitle("🚫 Cancelled")
		.setDescription(`The ${action} was cancelled. No action was taken.`)
		.setColor(Colors.Grey)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

/**
 * Embed shown when the confirmation prompt times out.
 */
export const buildTimedOutEmbed = (action: string) =>
	new EmbedBuilder()
		.setTitle("⏱️ Timed Out")
		.setDescription(`The confirmation prompt expired after 30 seconds. ${action}`)
		.setColor(Colors.Grey)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

/**
 * Embed shown when a moderation action fails.
 */
export const buildErrorEmbed = (title: string, description: string) =>
	new EmbedBuilder()
		.setTitle(`❌ ${title}`)
		.setDescription(description)
		.setColor(Colors.Red)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();

/**
 * Builds a standard "🎯 Target" embed field for a GuildMember.
 */
export const targetField = (target: GuildMember, extra?: string[], inline = true) => ({
	name: "🎯 Target",
	value: blockQuote(
		[
			`${inlineCode("User:")} ${bold(target.user.tag)}`,
			`${inlineCode("ID:")}   ${inlineCode(target.id)}`,
			...(extra ?? []),
		].join("\n"),
	),
	inline,
});

/**
 * Builds a standard "🎯 Target" embed field from raw strings (e.g. for unbanned users not in cache).
 */
export const targetFieldRaw = (tag: string, id: string, extra?: string[], inline = true) => ({
	name: "🎯 Target",
	value: blockQuote(
		[`${inlineCode("User:")} ${bold(tag)}`, `${inlineCode("ID:")}   ${inlineCode(id)}`, ...(extra ?? [])].join(
			"\n",
		),
	),
	inline,
});

/**
 * Builds a standard "🛡️ Executor" embed field.
 */
export const executorField = (executor: GuildMember, extra?: string[], inline = true) => ({
	name: "🛡️ Executor",
	value: blockQuote(
		[
			`${inlineCode("User:")} ${bold(executor.user.tag)}`,
			`${inlineCode("ID:")}   ${inlineCode(executor.id)}`,
			...(extra ?? []),
		].join("\n"),
	),
	inline,
});

/**
 * Builds a standard "🛡️ Executor" embed field with duration info (for result embeds).
 */
export const executorFieldWithDuration = (executor: { tag: string }, startedAt: Date, inline = true) => ({
	name: "🛡️ Executor",
	value: blockQuote(
		[
			`${inlineCode("User:")}     ${bold(executor.tag)}`,
			`${inlineCode("Duration:")} ${bold(`${Date.now() - startedAt.getTime()}ms`)}`,
		].join("\n"),
	),
	inline,
});

/**
 * Builds a standard "📝 Reason" embed field.
 */
export const reasonField = (reason: string, label = "📝 Reason") => ({
	name: label,
	value: blockQuote(bold(reason)),
	inline: false,
});

/**
 * Builds a standard "🕐 Requested At" embed field with full date and relative time.
 */
export const requestedAtField = () => ({
	name: "🕐 Requested At",
	value: blockQuote(
		`${time(new Date(), TimestampStyles.FullDateShortTime)} (${time(new Date(), TimestampStyles.RelativeTime)})`,
	),
	inline: false,
});

/**
 * Guard that ensures the interaction is in a cached guild.
 * If not, replies with an ephemeral error and returns `false`.
 */
export const ensureGuild = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
	if (interaction.inCachedGuild()) return true;

	await interaction.reply({
		content: blockQuote(`⛔ ${bold("Server only")} — This command cannot be used in DMs.`),
		flags: MessageFlags.Ephemeral,
	});
	return false;
};

/**
 * Replies with a standard "member not found" error.
 */
export const replyMemberNotFound = async (interaction: ChatInputCommandInteraction, userId: string) => {
	await interaction.editReply({
		content: blockQuote(
			`⛔ ${bold("Member not found")} — ${userMention(userId)} (${inlineCode(userId)}) is not in this server.`,
		),
	});
};

/**
 * Replies with a standard "action blocked" error.
 */
export const replyActionBlocked = async (interaction: ChatInputCommandInteraction, reason: string) => {
	await interaction.editReply({
		content: blockQuote(`⛔ ${bold("Action blocked")} — ${reason}`),
	});
};

export interface BlockReasonConfig {
	/** The permission check (e.g. target.bannable, target.kickable) */
	permissionCheck: boolean;
	/** Message when the bot doesn't have permission */
	noPermissionMessage: string;
	/** The verb for self-action (e.g. "ban", "kick", "mute") */
	action: string;
}

/**
 * Generic block reason check for moderation commands that target a GuildMember.
 */
export const getBlockReason = (
	executor: GuildMember,
	target: GuildMember,
	me: GuildMember,
	config: BlockReasonConfig,
): string | null => {
	if (!config.permissionCheck) return config.noPermissionMessage;
	if (target.id === executor.id) return `You cannot ${config.action} yourself.`;
	if (target.id === me.id) return `I cannot ${config.action} myself.`;
	if (target.roles.highest.position >= executor.roles.highest.position)
		return `You cannot ${config.action} a member with an equal or higher role than yours.`;
	return null;
};

export interface ConfirmCollectorOptions {
	interaction: ChatInputCommandInteraction<"cached">;
	confirmId: string;
	cancelId: string;
	cancelledAction: string;
	timedOutMessage: string;
	buildConfirmRowDisabled: () => ActionRowBuilder<ButtonBuilder>;
	onConfirm: () => Promise<void>;
}

/**
 * Creates and handles a standard confirmation collector with cancel & timeout.
 * Reduces the duplicated collector.on("collect")/collector.on("end") pattern.
 */
export const createConfirmationCollector = (opts: ConfirmCollectorOptions) => {
	const { interaction, confirmId, cancelId, cancelledAction, timedOutMessage, buildConfirmRowDisabled, onConfirm } =
		opts;

	const message = interaction.fetchReply();

	message.then((msg) => {
		const collector = msg.createMessageComponentCollector({
			filter: (btn) => btn.user.id === interaction.user.id,
			max: 1,
			time: 30_000,
		});

		collector.on("collect", async (btn) => {
			await btn.deferUpdate();

			if (btn.customId === cancelId) {
				await interaction.editReply({
					embeds: [buildCancelledEmbed(cancelledAction)],
					components: [],
				});
				return;
			}

			if (btn.customId === confirmId) {
				await onConfirm();
			}
		});

		collector.on("end", async (_, reason) => {
			if (reason === "time") {
				await interaction
					.editReply({
						embeds: [buildTimedOutEmbed(timedOutMessage)],
						components: [buildConfirmRowDisabled()],
					})
					.catch(() => null);
			}
		});
	});
};

/**
 * Helper to pluralise a word based on a count.
 */
export const pluralise = (n: number, word: string) => `${bold(String(n))} ${word}${n !== 1 ? "s" : ""}`;
