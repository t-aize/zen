import {
	blockQuote,
	bold,
	type Collection,
	Colors,
	EmbedBuilder,
	type GuildTextBasedChannel,
	inlineCode,
	type Message,
	PermissionFlagsBits,
	SlashCommandBuilder,
	type Snowflake,
	userMention,
} from "discord.js";
import { defineCommand } from "@/commands/index.js";
import { createLogger } from "@/utils/logger.js";
import {
	buildConfirmRow,
	createConfirmationCollector,
	ensureGuild,
	executorFieldWithDuration,
	pluralise,
	requestedAtField,
} from "@/utils/moderation.js";

const CONFIRM_ID = "purge:confirm";
const CANCEL_ID = "purge:cancel";

const MAX_BULK_AGE_MS = 14 * 24 * 60 * 60 * 1_000;
const FETCH_BATCH = 100;

const log = createLogger("purge");

const buildPreviewEmbed = (
	target: { tag: string; id: string; avatarURL: string | null },
	limit: number,
	channelCount: number,
	executor: { tag: string; id: string },
) =>
	new EmbedBuilder()
		.setTitle("🗑️ User Message Purge")
		.setDescription(
			[
				`You are about to delete ${bold("all recent messages")} from ${userMention(target.id)} across the entire server.`,
				`⚠️ ${bold("This action cannot be undone.")} Messages older than 14 days will be skipped.`,
			].join("\n"),
		)
		.setThumbnail(target.avatarURL)
		.setColor(Colors.Yellow)
		.addFields(
			{
				name: "🎯 Target",
				value: blockQuote(
					[
						`${inlineCode("User:")}     ${bold(target.tag)}`,
						`${inlineCode("ID:")}       ${inlineCode(target.id)}`,
						`${inlineCode("Limit:")}    ${bold(String(limit))} messages per channel`,
						`${inlineCode("Channels:")} ${bold(String(channelCount))} text channels scanned`,
					].join("\n"),
				),
				inline: false,
			},
			{
				name: "🛡️ Executor",
				value: blockQuote(
					[
						`${inlineCode("User:")} ${bold(executor.tag)}`,
						`${inlineCode("ID:")}   ${inlineCode(executor.id)}`,
					].join("\n"),
				),
				inline: true,
			},
			requestedAtField(),
		)
		.setFooter({ text: "Zen • Moderation — Confirm or cancel below" })
		.setTimestamp();

const buildResultEmbed = (
	target: { tag: string; id: string },
	deleted: number,
	skipped: number,
	channelsAffected: number,
	executor: { tag: string },
	startedAt: Date,
) => {
	const success = deleted > 0;

	return new EmbedBuilder()
		.setTitle(success ? "✅ Purge Complete" : "⚠️ Nothing Deleted")
		.setDescription(
			success
				? `Successfully purged ${pluralise(deleted, "message")} from ${userMention(target.id)} across ${pluralise(channelsAffected, "channel")}.${skipped > 0 ? `\n${pluralise(skipped, "message")} were skipped (older than 14 days).` : ""}`
				: `No eligible messages from ${userMention(target.id)} were found. All messages may be older than 14 days.`,
		)
		.setColor(success ? Colors.Green : Colors.Orange)
		.addFields(
			{
				name: "📊 Summary",
				value: blockQuote(
					[
						`${inlineCode("Target:")}   ${bold(target.tag)}`,
						`${inlineCode("Deleted:")}  ${bold(String(deleted))}`,
						`${inlineCode("Skipped:")}  ${bold(String(skipped))}`,
						`${inlineCode("Channels:")} ${bold(String(channelsAffected))}`,
					].join("\n"),
				),
				inline: true,
			},
			executorFieldWithDuration(executor, startedAt),
		)
		.setFooter({ text: "Zen • Moderation" })
		.setTimestamp();
};

/**
 * Fetches up to `limit` messages from a single channel that belong to `userId`
 * and are young enough for bulk-delete. Returns [toDelete, skipped count].
 */
const collectFromChannel = async (
	channel: GuildTextBasedChannel,
	userId: string,
	limit: number,
): Promise<[Message[], number]> => {
	const cutoff = Date.now() - MAX_BULK_AGE_MS;
	const toDelete: Message[] = [];
	let skipped = 0;
	let lastId: Snowflake | undefined;

	outer: while (toDelete.length < limit) {
		const batch: Collection<Snowflake, Message> = await channel.messages.fetch({
			limit: FETCH_BATCH,
			...(lastId ? { before: lastId } : {}),
		});

		if (batch.size === 0) break;

		for (const msg of batch.values()) {
			if (msg.author.id !== userId) continue;
			if (msg.createdTimestamp < cutoff) {
				skipped++;
				continue;
			}
			toDelete.push(msg);
			if (toDelete.length >= limit) break outer;
		}

		lastId = batch.last()?.id;
		if (batch.size < FETCH_BATCH) break;
	}

	return [toDelete, skipped];
};

defineCommand({
	data: new SlashCommandBuilder()
		.setName("purge")
		.setDescription("Delete all recent messages from a specific user across the entire server.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.setNSFW(false)
		.addUserOption((opt) =>
			opt.setName("user").setDescription("The user whose messages will be purged.").setRequired(true),
		)
		.addIntegerOption((opt) =>
			opt
				.setName("limit")
				.setDescription("Max messages to delete per channel (1–100). Defaults to 100.")
				.setMinValue(1)
				.setMaxValue(FETCH_BATCH)
				.setRequired(false),
		),

	execute: async (interaction) => {
		if (!(await ensureGuild(interaction))) return;
		if (!interaction.inCachedGuild()) return;

		await interaction.deferReply({ flags: 64 });

		const targetUser = interaction.options.getUser("user", true);
		const limit = interaction.options.getInteger("limit") ?? FETCH_BATCH;
		const executor = interaction.member;

		const textChannels = interaction.guild.channels.cache.filter(
			(ch): ch is GuildTextBasedChannel =>
				"messages" in ch &&
				ch.viewable &&
				ch.permissionsFor(interaction.guild.members.me!)?.has(PermissionFlagsBits.ManageMessages) === true,
		);

		if (textChannels.size === 0) {
			await interaction.editReply({
				content: blockQuote(
					`⛔ ${bold("No accessible channels")} — I don't have ${inlineCode("Manage Messages")} permission in any text channel.`,
				),
			});
			return;
		}

		await interaction.editReply({
			embeds: [
				buildPreviewEmbed(
					{
						tag: targetUser.tag,
						id: targetUser.id,
						avatarURL: targetUser.displayAvatarURL(),
					},
					limit,
					textChannels.size,
					{ tag: executor.user.tag, id: executor.id },
				),
			],
			components: [buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Purge", "🗑️")],
		});

		createConfirmationCollector({
			interaction,
			confirmId: CONFIRM_ID,
			cancelId: CANCEL_ID,
			cancelledAction: "purge",
			timedOutMessage: "No messages were deleted.",
			buildConfirmRowDisabled: () =>
				buildConfirmRow(CONFIRM_ID, CANCEL_ID, "Confirm Purge", "🗑️", undefined, true),
			onConfirm: async () => {
				const startedAt = new Date();
				let totalDeleted = 0;
				let totalSkipped = 0;
				let channelsAffected = 0;

				for (const channel of textChannels.values()) {
					try {
						const [toDelete, skipped] = await collectFromChannel(channel, targetUser.id, limit);
						totalSkipped += skipped;

						if (toDelete.length === 0) continue;

						const result = await channel.bulkDelete(toDelete, true);
						totalDeleted += result.size;
						channelsAffected++;

						log.debug(
							{ channelId: channel.id, deleted: result.size, targetId: targetUser.id },
							`Purged ${result.size} messages in #${channel.name}`,
						);
					} catch (err) {
						log.warn(
							{ err, channelId: channel.id, targetId: targetUser.id },
							`Failed to purge messages in channel ${channel.id}`,
						);
					}
				}

				log.info(
					{
						targetId: targetUser.id,
						executorId: executor.id,
						totalDeleted,
						totalSkipped,
						channelsAffected,
						durationMs: Date.now() - startedAt.getTime(),
					},
					`${executor.user.tag} purged ${totalDeleted} messages from ${targetUser.tag}`,
				);

				await interaction.editReply({
					embeds: [
						buildResultEmbed(
							{ tag: targetUser.tag, id: targetUser.id },
							totalDeleted,
							totalSkipped,
							channelsAffected,
							{ tag: executor.user.tag },
							startedAt,
						),
					],
					components: [],
				});
			},
		});
	},
});
